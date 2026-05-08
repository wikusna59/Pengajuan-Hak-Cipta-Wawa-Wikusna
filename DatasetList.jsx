import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Database, PlayCircle, CheckCircle, Clock, ChevronRight, Search, X, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DatasetList = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [deleting, setDeleting] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const fetchDatasets = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/datasets`);
      setDatasets(response.data.datasets);
      setLoading(false);
    } catch (error) {
      toast.error('Gagal memuat daftar dataset');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleProcess = async (datasetId, hasResult, resultId) => {
    if (hasResult && resultId) {
      // Navigate to existing result
      navigate(`/process/${resultId}`);
      return;
    }

    // Process the dataset
    setProcessing(prev => ({ ...prev, [datasetId]: true }));

    try {
      const response = await axios.post(`${API}/process-mining/${datasetId}`);
      const newResultId = response.data.id;
      
      toast.success('Dataset berhasil diproses!');
      setProcessing(prev => ({ ...prev, [datasetId]: false }));
      
      // Update datasets list
      await fetchDatasets();
      
      // Navigate to result
      navigate(`/process/${newResultId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal memproses dataset');
      setProcessing(prev => ({ ...prev, [datasetId]: false }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter datasets based on search query
  const filteredDatasets = datasets.filter(dataset => 
    dataset.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleDelete = async (datasetId, filename) => {
    // Confirmation dialog
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus dataset "${filename}"?\n\nData yang akan dihapus:\n- Event log\n- Hasil process mining\n- Hasil clustering\n\nTindakan ini tidak dapat dibatalkan.`
    );

    if (!confirmed) return;

    setDeleting(prev => ({ ...prev, [datasetId]: true }));

    try {
      await axios.delete(`${API}/dataset/${datasetId}`);
      
      toast.success(`Dataset "${filename}" berhasil dihapus`);
      
      // Refresh dataset list
      await fetchDatasets();
      
      setDeleting(prev => ({ ...prev, [datasetId]: false }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menghapus dataset');
      setDeleting(prev => ({ ...prev, [datasetId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="text-center py-8">
        <Database className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
        <p className="text-zinc-500 text-sm">Belum ada dataset yang di-upload</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-bold text-zinc-800" style={{ fontFamily: 'Syne, sans-serif' }}>
            Dataset Tersedia
          </h3>
          <span className="text-sm text-zinc-500">
            ({filteredDatasets.length}{searchQuery && ` dari ${datasets.length}`})
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <input
          type="text"
          placeholder="Cari berdasarkan nama file..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:outline-none text-zinc-800 placeholder-zinc-400 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Dataset List */}
      {filteredDatasets.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-gray-200">
          <Search className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
          <p className="text-zinc-600 font-medium mb-1">Tidak ada dataset ditemukan</p>
          <p className="text-zinc-500 text-sm">Coba gunakan kata kunci yang berbeda</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {filteredDatasets.map((dataset) => (
          <div
            key={dataset.dataset_id}
            className="group bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {dataset.has_result ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  )}
                  <span className="text-sm font-bold text-zinc-800 truncate" title={dataset.filename}>
                    {dataset.filename}
                  </span>
                </div>
                
                <div className="text-xs text-zinc-500 mb-2 truncate" title={dataset.dataset_id}>
                  ID: {dataset.dataset_id.slice(0, 8)}...
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-zinc-500">Rows:</span>
                    <span className="ml-2 font-semibold text-zinc-800">{dataset.rows_count.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Upload:</span>
                    <span className="ml-2 text-zinc-700 text-xs">{formatDate(dataset.upload_date)}</span>
                  </div>
                  {dataset.processed_date && (
                    <div className="col-span-2">
                      <span className="text-zinc-500">Diproses:</span>
                      <span className="ml-2 text-emerald-600 font-medium text-xs">{formatDate(dataset.processed_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  onClick={() => handleProcess(dataset.dataset_id, dataset.has_result, dataset.result_id)}
                  disabled={processing[dataset.dataset_id] || deleting[dataset.dataset_id]}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    dataset.has_result
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-2 border-emerald-300'
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-700 border-2 border-amber-300'
                  }`}
                >
                  {(() => {
                    if (processing[dataset.dataset_id]) {
                      return (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          <span className="hidden sm:inline">Processing...</span>
                        </>
                      );
                    }
                    if (dataset.has_result) {
                      return (
                        <>
                          <ChevronRight className="w-4 h-4" />
                          <span className="hidden sm:inline">Lihat Hasil</span>
                        </>
                      );
                    }
                    return (
                      <>
                        <PlayCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Proses</span>
                      </>
                    );
                  })()}
                </Button>

                <Button
                  onClick={() => handleDelete(dataset.dataset_id, dataset.filename)}
                  disabled={deleting[dataset.dataset_id] || processing[dataset.dataset_id]}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-red-100 hover:bg-red-200 text-red-700 border-2 border-red-300 disabled:opacity-50"
                  title="Hapus dataset"
                >
                  {deleting[dataset.dataset_id] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      <span className="hidden sm:inline">Hapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Hapus</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};

export default DatasetList;
