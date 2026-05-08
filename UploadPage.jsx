import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, FileText, Activity, ChevronRight, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import DatasetList from '../components/DatasetList';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const UploadPage = ({ onUploadSuccess, onMiningSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  // Hide ReactFlow attribution
  useEffect(() => {
    const hideAttribution = () => {
      const attributions = document.querySelectorAll('.react-flow__attribution, a[href*="reactflow"], [class*="attribution"]');
      attributions.forEach(el => {
        if (el) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
        }
      });
    };
    
    hideAttribution();
    const interval = setInterval(hideAttribution, 500);
    
    return () => clearInterval(interval);
  }, []);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
      } else {
        toast.error('Invalid file type. Please upload CSV or Excel file.');
      }
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await axios.post(`${API}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const datasetId = uploadResponse.data.dataset_id;
      toast.success(`File uploaded! ${uploadResponse.data.rows_count} rows processed`);
      onUploadSuccess(datasetId);

      setUploading(false);
      setProcessing(true);

      const miningResponse = await axios.post(`${API}/process-mining/${datasetId}`);
      const resultId = miningResponse.data.id;
      
      toast.success('Process mining completed!');
      onMiningSuccess(resultId);
      setProcessing(false);

      navigate(`/process/${resultId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'An error occurred');
      setUploading(false);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-emerald-50">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-lime-200/30 to-emerald-200/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-100/40 to-lime-100/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-lime-50/50 to-emerald-50/50 rounded-full blur-3xl" />
      
      <div className="max-w-5xl w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-none mb-3 text-zinc-800" style={{ fontFamily: 'Syne, sans-serif' }}>
            PEMODELAN
          </h1>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-none mb-8" style={{ fontFamily: 'Syne, sans-serif' }}>
            <span className="bg-gradient-to-r from-emerald-600 via-lime-600 to-emerald-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              PROSES BISNIS
            </span>
          </h1>
          
          <p className="text-xl leading-relaxed text-zinc-600 max-w-2xl mx-auto mb-8 font-medium" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Analisis Proses Produksi Garmen dengan Pendekatan Process Mining
          </p>
          
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-xl rounded-full border border-emerald-200 shadow-lg shadow-emerald-100/50">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-zinc-700 font-medium" style={{ fontFamily: 'Manrope, sans-serif' }}>Visualisasi Petri Net</span>
            </div>
          </div>
        </div>

        {/* Download Template Button */}
        <div className="flex justify-end mb-4">
          <a
            href="/templates/Template_Dataset_Garment_Production.xlsx"
            download="Template_Dataset_Garment_Production.xlsx"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-xl rounded-full border-2 border-emerald-300 shadow-lg shadow-emerald-100/50 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-emerald-200/50 transition-all duration-300 group"
            data-testid="download-template-button"
          >
            <Download className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-zinc-700 font-medium" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Download Template Dataset
            </span>
          </a>
        </div>

        {/* Upload Zone */}
        <div
          className={`border-2 border-dashed transition-all duration-500 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer group relative overflow-hidden backdrop-blur-sm ${
            dragActive 
              ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-lime-50 shadow-2xl shadow-emerald-200/50 scale-[1.02]' 
              : 'border-zinc-300 bg-white/60 hover:border-emerald-400 hover:bg-gradient-to-br hover:from-emerald-50/50 hover:to-lime-50/50 hover:shadow-2xl hover:shadow-emerald-100/30 hover:scale-[1.01] shadow-lg shadow-zinc-200/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input').click()}
          data-testid="file-upload-zone"
        >
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-100/0 via-lime-100/30 to-emerald-100/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          {/* Dot pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            data-testid="file-input"
          />
          
          <div className="flex flex-col items-center relative z-10">
            {file ? (
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-emerald-300/50 rounded-full blur-2xl animate-pulse" />
                <FileText className="w-12 h-12 text-emerald-600 relative z-10" />
              </div>
            ) : (
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-emerald-200/50 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <Upload className="w-12 h-12 text-zinc-400 group-hover:text-emerald-600 transition-all duration-300 group-hover:scale-110 relative z-10" />
              </div>
            )}
            
            <h3 className="text-lg font-bold mb-2 text-zinc-800" style={{ fontFamily: 'Syne, sans-serif' }}>
              {file ? file.name : 'Upload Data Event Log Produksi'}
            </h3>
            
            <p className="text-sm text-zinc-600 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {file ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  {(file.size / 1024).toFixed(2)} KB
                </span>
              ) : (
                'Drag & drop atau klik untuk memilih file produksi (.csv, .xlsx)'
              )}
            </p>
            
            {file && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="bg-white border-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-all rounded-full px-5 py-2 text-sm font-medium shadow-md"
                data-testid="clear-file-button"
              >
                Hapus File
              </Button>
            )}
          </div>
        </div>

        {/* Analyze Button */}
        {file && (
          <div className="mt-10 flex justify-center">
            <Button
              onClick={handleUpload}
              disabled={uploading || processing}
              className="group relative bg-gradient-to-r from-emerald-500 to-lime-500 text-white font-bold text-lg hover:from-emerald-600 hover:to-lime-600 transition-all rounded-full px-10 py-6 shadow-2xl shadow-emerald-300/50 hover:shadow-emerald-400/60 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              data-testid="analyze-button"
            >
              <span className="flex items-center gap-3">
                {(() => {
                  if (uploading) return 'Mengupload...';
                  if (processing) return 'Menjalankan Alpha Miner...';
                  return 'Mulai Analisis';
                })()}
                {!uploading && !processing && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
            </Button>
          </div>
        )}

        {/* Steps */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="group relative p-8 bg-white/80 backdrop-blur-xl rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 transition-all duration-300 overflow-hidden shadow-lg shadow-emerald-100/50 hover:shadow-xl hover:shadow-emerald-200/50">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent" />
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-100 to-lime-100 rounded-xl flex items-center justify-center border-2 border-emerald-300 shadow-md">
                <span className="text-2xl font-bold text-emerald-700">1</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-700 mb-2 uppercase tracking-wide">Langkah Pertama</h4>
                <p className="text-sm text-zinc-600 leading-relaxed">Upload Dataset Event Log Produksi dan Gunakan Template Dataset</p>
              </div>
            </div>
          </div>
          
          <div className="group relative p-8 bg-white/80 backdrop-blur-xl rounded-2xl border-2 border-lime-200 hover:border-lime-400 transition-all duration-300 overflow-hidden shadow-lg shadow-lime-100/50 hover:shadow-xl hover:shadow-lime-200/50">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-500 to-transparent" />
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-lime-100 to-emerald-100 rounded-xl flex items-center justify-center border-2 border-lime-300 shadow-md">
                <span className="text-2xl font-bold text-lime-700">2</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-lime-700 mb-2 uppercase tracking-wide">Langkah Kedua</h4>
                <p className="text-sm text-zinc-600 leading-relaxed">Pemodelan proses bisnis dengan Algoritma Alpha Miner</p>
              </div>
            </div>
          </div>
          
          <div className="group relative p-8 bg-white/80 backdrop-blur-xl rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 transition-all duration-300 overflow-hidden shadow-lg shadow-emerald-100/50 hover:shadow-xl hover:shadow-emerald-200/50">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-lime-500" />
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-100 to-lime-100 rounded-xl flex items-center justify-center border-2 border-emerald-300 shadow-md">
                <span className="text-2xl font-bold text-emerald-700">3</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-700 mb-2 uppercase tracking-wide">Langkah Ketiga</h4>
                <p className="text-sm text-zinc-600 leading-relaxed">Klasterisasi proses bisnis</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dataset List Section */}
        <div className="mt-6 bg-gradient-to-br from-white to-gray-50 rounded-3xl border-2 border-gray-200 p-8 shadow-xl">
          <DatasetList />
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
