from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timezone
import pandas as pd
import io
import pm4py
from pm4py.objects.log.obj import EventLog, Trace, Event
from pm4py.algo.discovery.alpha import algorithm as alpha_miner
from pm4py.objects.petri_net.obj import PetriNet, Marking
from pm4py.objects.petri_net.utils import petri_utils
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np
import markov_clustering as mc
from scipy.sparse import csr_matrix

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

class EventLogEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    case_id: str
    activity: str
    timestamp: str
    attributes: Dict[str, Any] = Field(default_factory=dict)

class ProcessMiningResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dataset_name: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    petri_net: Dict[str, Any]
    metrics: Dict[str, Any]
    statistics: Dict[str, Any]

class UploadResponse(BaseModel):
    success: bool
    message: str
    dataset_id: str
    rows_count: int
    columns: List[str]

class PetriNetResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    places: List[Dict[str, Any]]
    transitions: List[Dict[str, Any]]
    arcs: List[Dict[str, Any]]

class MetricsResponse(BaseModel):
    start_activities: List[Dict[str, Any]]
    end_activities: List[Dict[str, Any]]
    activity_frequency: List[Dict[str, Any]]
    case_duration: Dict[str, Any]
    total_cases: int
    total_events: int
    unique_activities: int

def parse_event_log(df: pd.DataFrame) -> EventLog:
    df = df.rename(columns={
        'Case ID': 'case:concept:name',
        'Activity': 'concept:name',
        'Timestamp': 'time:timestamp'
    })
    
    df['time:timestamp'] = pd.to_datetime(df['time:timestamp'])
    df = df.sort_values(['case:concept:name', 'time:timestamp'])
    
    event_log = EventLog()
    for case_id, case_df in df.groupby('case:concept:name'):
        trace = Trace()
        trace.attributes['concept:name'] = str(case_id)
        
        for _, row in case_df.iterrows():
            event = Event()
            event['concept:name'] = row['concept:name']
            event['time:timestamp'] = row['time:timestamp']
            for col in df.columns:
                if col not in ['case:concept:name', 'concept:name', 'time:timestamp']:
                    event[col] = row[col]
            trace.append(event)
        
        event_log.append(trace)
    
    return event_log

def convert_petri_net_to_dict(net: PetriNet, im: Marking, fm: Marking) -> Dict[str, Any]:
    places = []
    transitions = []
    arcs = []
    
    place_id_map = {}
    for idx, place in enumerate(net.places):
        place_id = f"p{idx}"
        place_id_map[place] = place_id
        places.append({
            "id": place_id,
            "label": place.name if place.name else place_id,
            "type": "place",
            "isStart": place in im,
            "isEnd": place in fm,
            "tokens": im[place] if place in im else 0
        })
    
    trans_id_map = {}
    for idx, trans in enumerate(net.transitions):
        trans_id = f"t{idx}"
        trans_id_map[trans] = trans_id
        transitions.append({
            "id": trans_id,
            "label": trans.label if trans.label else trans.name,
            "type": "transition",
            "isSilent": trans.label is None
        })
    
    for arc in net.arcs:
        source_id = place_id_map.get(arc.source) or trans_id_map.get(arc.source)
        target_id = place_id_map.get(arc.target) or trans_id_map.get(arc.target)
        
        if source_id and target_id:
            arcs.append({
                "id": f"arc_{source_id}_{target_id}",
                "source": source_id,
                "target": target_id,
                "weight": arc.weight if hasattr(arc, 'weight') else 1
            })
    
    return {
        "places": places,
        "transitions": transitions,
        "arcs": arcs
    }

def calculate_metrics(event_log: EventLog, df: pd.DataFrame) -> Dict[str, Any]:
    start_activities = {}
    end_activities = {}
    activity_frequency = {}
    
    for trace in event_log:
        if len(trace) > 0:
            first_activity = trace[0]['concept:name']
            last_activity = trace[-1]['concept:name']
            
            start_activities[first_activity] = start_activities.get(first_activity, 0) + 1
            end_activities[last_activity] = end_activities.get(last_activity, 0) + 1
            
            for event in trace:
                activity = event['concept:name']
                activity_frequency[activity] = activity_frequency.get(activity, 0) + 1
    
    case_durations = []
    for trace in event_log:
        if len(trace) > 1:
            start_time = trace[0]['time:timestamp']
            end_time = trace[-1]['time:timestamp']
            duration = (end_time - start_time).total_seconds() / 3600
            case_durations.append(duration)
    
    return {
        "start_activities": [{"activity": k, "count": v} for k, v in sorted(start_activities.items(), key=lambda x: x[1], reverse=True)],
        "end_activities": [{"activity": k, "count": v} for k, v in sorted(end_activities.items(), key=lambda x: x[1], reverse=True)],
        "activity_frequency": [{"activity": k, "count": v} for k, v in sorted(activity_frequency.items(), key=lambda x: x[1], reverse=True)],
        "case_duration": {
            "min": min(case_durations) if case_durations else 0,
            "max": max(case_durations) if case_durations else 0,
            "avg": sum(case_durations) / len(case_durations) if case_durations else 0,
            "median": sorted(case_durations)[len(case_durations) // 2] if case_durations else 0,
            "distribution": case_durations[:100]
        },
        "total_cases": len(event_log),
        "total_events": sum(len(trace) for trace in event_log),
        "unique_activities": len(activity_frequency)
    }

def calculate_business_analysis(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate business analysis metrics: total employees, cost, and duration"""
    
    # Initialize totals
    total_employees = 0
    total_cost = 0.0
    total_duration = 0.0
    
    # Check for employee column (various possible names)
    employee_cols = ['jumlah_pegawai', 'Jumlah Pegawai', 'jumlah pegawai', 'employees', 'num_employees', 'Jumlah_Pegawai']
    for col in employee_cols:
        if col in df.columns:
            try:
                total_employees = int(pd.to_numeric(df[col], errors='coerce').fillna(0).sum())
            except (ValueError, TypeError):
                total_employees = 0
            break
    
    # Check for cost column (various possible names)
    cost_cols = ['biaya', 'Biaya', 'cost', 'Cost', 'total_cost', 'Biaya_Produksi']
    for col in cost_cols:
        if col in df.columns:
            try:
                total_cost = float(pd.to_numeric(df[col], errors='coerce').fillna(0).sum())
            except (ValueError, TypeError):
                total_cost = 0.0
            break
    
    # Check for duration column (various possible names)
    duration_cols = ['durasi', 'Durasi', 'duration', 'Duration', 'waktu', 'Waktu']
    for col in duration_cols:
        if col in df.columns:
            try:
                total_duration = float(pd.to_numeric(df[col], errors='coerce').fillna(0).sum())
            except (ValueError, TypeError):
                total_duration = 0.0
            break
    
    return {
        "total_employees": total_employees,
        "total_cost": total_cost,
        "total_duration": total_duration
    }

@api_router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or Excel file.")
        
        # Try multiple column mappings for flexibility
        column_mappings = [
            # New dataset format (Garment Production)
            {
                'id_Produksi': 'Case ID',
                'nama_aktivitas': 'Activity',
                'timestamp': 'Timestamp'
            },
            # Old dataset format
            {
                'Id': 'Case ID',
                'PN': 'Activity',
                'created': 'Timestamp'
            },
            # Standard format (no mapping needed)
            {}
        ]
        
        # Try each mapping
        original_columns = df.columns.tolist()
        
        for mapping in column_mappings:
            temp_df = df.copy()
            for old_col, new_col in mapping.items():
                if old_col in temp_df.columns:
                    temp_df = temp_df.rename(columns={old_col: new_col})
            
            # Check if all required columns are present
            required_columns = ['Case ID', 'Activity', 'Timestamp']
            if all(col in temp_df.columns for col in required_columns):
                df = temp_df
                break
        
        # If no mapping worked, show available columns
        required_columns = ['Case ID', 'Activity', 'Timestamp']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}. Available columns: {', '.join(original_columns)}. Please ensure your file has columns for Case ID, Activity Name, and Timestamp."
            )
        
        dataset_id = str(uuid.uuid4())
        
        records = df.to_dict('records')
        for record in records:
            record['dataset_id'] = dataset_id
            record['filename'] = file.filename  # Save filename
            record['timestamp_stored'] = datetime.now(timezone.utc).isoformat()
        
        await db.event_logs.insert_many(records)
        
        return UploadResponse(
            success=True,
            message="File uploaded successfully",
            dataset_id=dataset_id,
            rows_count=len(df),
            columns=df.columns.tolist()
        )
    
    except Exception as e:
        logging.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/process-mining/{dataset_id}")
async def run_process_mining(dataset_id: str):
    try:
        # Add limit to prevent memory exhaustion with large datasets
        records = await db.event_logs.find({"dataset_id": dataset_id}, {"_id": 0}).to_list(length=50000)
        
        if not records:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        df = pd.DataFrame(records)
        
        event_log = parse_event_log(df)
        
        net, initial_marking, final_marking = alpha_miner.apply(event_log)
        
        petri_net_dict = convert_petri_net_to_dict(net, initial_marking, final_marking)
        
        metrics = calculate_metrics(event_log, df)
        
        result = {
            "id": str(uuid.uuid4()),
            "dataset_id": dataset_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "petri_net": petri_net_dict,
            "metrics": metrics,
            "statistics": {
                "places_count": len(petri_net_dict["places"]),
                "transitions_count": len(petri_net_dict["transitions"]),
                "arcs_count": len(petri_net_dict["arcs"])
            }
        }
        
        result_copy = result.copy()
        await db.process_mining_results.insert_one(result_copy)
        
        return result
    
    except Exception as e:
        logging.error(f"Error running process mining: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/petri-net/{result_id}")
async def get_petri_net(result_id: str):
    try:
        result = await db.process_mining_results.find_one({"id": result_id}, {"_id": 0})
        
        if not result:
            raise HTTPException(status_code=404, detail="Result not found")
        
        return result["petri_net"]
    
    except Exception as e:
        logging.error(f"Error getting petri net: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/metrics/{result_id}")
async def get_metrics(result_id: str):
    try:
        result = await db.process_mining_results.find_one({"id": result_id}, {"_id": 0})
        
        if not result:
            raise HTTPException(status_code=404, detail="Result not found")
        
        return result["metrics"]
    
    except Exception as e:
        logging.error(f"Error getting metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/activities")
async def get_activities(dataset_id: Optional[str] = None):
    try:
        query = {}
        if dataset_id:
            query["dataset_id"] = dataset_id
        
        # Add limit to prevent fetching too many records
        records = await db.event_logs.find(query, {"_id": 0, "Activity": 1}).to_list(length=10000)
        activities = list(set(record["Activity"] for record in records if "Activity" in record))
        
        return {"activities": sorted(activities)}
    
    except Exception as e:
        logging.error(f"Error getting activities: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/cluster/{result_id}")
async def cluster_process(result_id: str, num_clusters: int = 3, algorithm: str = "kmeans"):
    try:
        # Get original result
        result = await db.process_mining_results.find_one({"id": result_id}, {"_id": 0})
        if not result:
            raise HTTPException(status_code=404, detail="Result not found")
        
        dataset_id = result["dataset_id"]
        
        # Get event logs with limit to prevent memory issues
        records = await db.event_logs.find({"dataset_id": dataset_id}, {"_id": 0}).to_list(length=50000)
        if not records:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        df = pd.DataFrame(records)
        event_log = parse_event_log(df)
        
        # Extract features for clustering (activity frequency per case)
        case_features = []
        case_ids = []
        
        # Get all unique activities
        all_activities = list(set(event['concept:name'] for trace in event_log for event in trace))
        activity_to_idx = {act: idx for idx, act in enumerate(all_activities)}
        
        for trace in event_log:
            case_id = trace.attributes['concept:name']
            case_ids.append(case_id)
            
            # Create feature vector (activity frequency)
            feature_vector = [0] * len(all_activities)
            for event in trace:
                activity = event['concept:name']
                feature_vector[activity_to_idx[activity]] += 1
            
            case_features.append(feature_vector)
        
        # Perform clustering based on selected algorithm
        X = np.array(case_features)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        if algorithm == "markov":
            # Markov Clustering Algorithm
            # Create similarity matrix from feature vectors
            n_cases = len(case_ids)
            
            # Compute cosine similarity matrix
            from sklearn.metrics.pairwise import cosine_similarity
            similarity_matrix = cosine_similarity(X_scaled)
            
            # Convert to non-negative values (MCL requires non-negative)
            similarity_matrix = np.maximum(similarity_matrix, 0)
            
            # Set diagonal to 0 (no self-loops for MCL)
            np.fill_diagonal(similarity_matrix, 0)
            
            # Convert to sparse matrix
            sparse_matrix = csr_matrix(similarity_matrix)
            
            # Run Markov Clustering
            # Inflation parameter controls cluster granularity (higher = more clusters)
            inflation = 1.4 + (num_clusters - 2) * 0.3  # Adjust inflation based on desired clusters
            inflation = min(max(inflation, 1.2), 5.0)  # Keep within reasonable bounds
            
            mcl_result = mc.run_mcl(sparse_matrix, inflation=inflation)
            mcl_clusters = mc.get_clusters(mcl_result)
            
            # Convert MCL clusters to labels
            cluster_labels = np.zeros(n_cases, dtype=int)
            for cluster_idx, node_indices in enumerate(mcl_clusters):
                for node_idx in node_indices:
                    cluster_labels[node_idx] = cluster_idx
            
            # If MCL produces more clusters than requested, merge smallest ones
            unique_labels = np.unique(cluster_labels)
            if len(unique_labels) > num_clusters:
                # Count cases per cluster
                cluster_counts = [(label, np.sum(cluster_labels == label)) for label in unique_labels]
                cluster_counts.sort(key=lambda x: x[1], reverse=True)
                
                # Keep top num_clusters, merge rest into last cluster
                keep_labels = [c[0] for c in cluster_counts[:num_clusters]]
                new_labels = np.zeros_like(cluster_labels)
                for i, label in enumerate(cluster_labels):
                    if label in keep_labels:
                        new_labels[i] = keep_labels.index(label)
                    else:
                        new_labels[i] = num_clusters - 1
                cluster_labels = new_labels
            
            algorithm_name = "Markov Cluster"
        else:
            # KMeans Clustering (default)
            kmeans = KMeans(n_clusters=min(num_clusters, len(case_ids)), random_state=42)
            cluster_labels = kmeans.fit_predict(X_scaled)
            algorithm_name = "K-Means"
        
        # Generate Petri Net for each cluster
        clustered_results = []
        
        actual_clusters = len(np.unique(cluster_labels))
        for cluster_idx in range(actual_clusters):
            # Get cases in this cluster
            cluster_case_ids = [case_ids[i] for i, label in enumerate(cluster_labels) if label == cluster_idx]
            
            if not cluster_case_ids:
                continue
            
            # Filter event log for this cluster
            cluster_event_log = EventLog()
            for trace in event_log:
                if trace.attributes['concept:name'] in cluster_case_ids:
                    cluster_event_log.append(trace)
            
            if len(cluster_event_log) == 0:
                continue
            
            # Apply alpha miner to cluster
            try:
                # Convert case_ids to match df types for filtering
                cluster_case_ids_set = set(cluster_case_ids)
                cluster_df = df[df['Case ID'].astype(str).isin(cluster_case_ids_set)]
                
                net, initial_marking, final_marking = alpha_miner.apply(cluster_event_log)
                petri_net_dict = convert_petri_net_to_dict(net, initial_marking, final_marking)
                metrics = calculate_metrics(cluster_event_log, cluster_df)
                business_analysis = calculate_business_analysis(cluster_df)
                
                clustered_results.append({
                    "cluster_id": cluster_idx,
                    "cluster_name": f"Cluster {cluster_idx + 1}",
                    "num_cases": len(cluster_case_ids),
                    "petri_net": petri_net_dict,
                    "metrics": metrics,
                    "business_analysis": business_analysis,
                    "statistics": {
                        "places_count": len(petri_net_dict["places"]),
                        "transitions_count": len(petri_net_dict["transitions"]),
                        "arcs_count": len(petri_net_dict["arcs"])
                    }
                })
            except Exception as e:
                logging.warning(f"Failed to create Petri Net for cluster {cluster_idx}: {str(e)}")
                continue
        
        # Calculate business analysis for original (all cases)
        original_business_analysis = calculate_business_analysis(df)
        
        # Store clustering result
        clustering_result = {
            "id": str(uuid.uuid4()),
            "result_id": result_id,
            "num_clusters": num_clusters,
            "algorithm": algorithm_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "original_petri_net": result["petri_net"],
            "original_metrics": result["metrics"],
            "original_business_analysis": original_business_analysis,
            "clusters": clustered_results
        }
        
        clustering_result_copy = clustering_result.copy()
        await db.clustering_results.insert_one(clustering_result_copy)
        
        return clustering_result
    
    except Exception as e:
        logging.error(f"Error clustering process: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/datasets")
async def get_datasets():
    try:
        # Get unique datasets with their metadata
        pipeline = [
            {
                "$group": {
                    "_id": "$dataset_id",
                    "first_record": {"$first": "$$ROOT"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"first_record.timestamp_stored": -1}
            },
            {
                "$limit": 50
            }
        ]
        
        datasets = await db.event_logs.aggregate(pipeline).to_list(length=50)
        
        # Batch fetch all processed results to avoid N+1 query problem
        dataset_ids = [dataset["_id"] for dataset in datasets]
        processed_results_list = await db.process_mining_results.find(
            {"dataset_id": {"$in": dataset_ids}},
            {"_id": 0, "dataset_id": 1, "id": 1, "timestamp": 1}
        ).to_list(length=50)
        
        # Create lookup dictionary for O(1) access
        processed_results_map = {pr["dataset_id"]: pr for pr in processed_results_list}
        
        result = []
        for dataset in datasets:
            dataset_id = dataset["_id"]
            first_record = dataset["first_record"]
            
            # Lookup processed result from map instead of querying database
            processed_result = processed_results_map.get(dataset_id)
            
            result.append({
                "dataset_id": dataset_id,
                "filename": first_record.get("filename", "Unknown"),
                "rows_count": dataset["count"],
                "upload_date": first_record.get("timestamp_stored"),
                "has_result": processed_result is not None,
                "result_id": processed_result.get("id") if processed_result is not None else None,
                "processed_date": processed_result.get("timestamp") if processed_result is not None else None
            })
        
        return {"datasets": result}
    
    except Exception as e:
        logging.error(f"Error getting datasets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/dataset/{dataset_id}")
async def delete_dataset(dataset_id: str):
    try:
        # Delete event logs
        delete_logs_result = await db.event_logs.delete_many({"dataset_id": dataset_id})
        
        # Delete process mining results
        delete_results = await db.process_mining_results.delete_many({"dataset_id": dataset_id})
        
        # Delete clustering results
        delete_clustering = await db.clustering_results.delete_many({"result_id": {"$regex": dataset_id}})
        
        if delete_logs_result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        return {
            "success": True,
            "message": "Dataset deleted successfully",
            "deleted_logs": delete_logs_result.deleted_count,
            "deleted_results": delete_results.deleted_count,
            "deleted_clustering": delete_clustering.deleted_count
        }
    
    except Exception as e:
        logging.error(f"Error deleting dataset: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "Pemodelan Proses Bisnis dengan Pendekatan Process Mining API", "version": "1.0.0"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_client():
    """Create database indexes on startup for better query performance"""
    try:
        # Create indexes for frequently queried fields
        await db.event_logs.create_index("dataset_id")
        await db.event_logs.create_index([("timestamp_stored", -1)])
        await db.event_logs.create_index([("dataset_id", 1), ("timestamp_stored", -1)])
        await db.process_mining_results.create_index("dataset_id")
        await db.process_mining_results.create_index("id")
        logging.info("Database indexes created successfully")
    except Exception as e:
        logging.warning(f"Could not create indexes: {str(e)}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()