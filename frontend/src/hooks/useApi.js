import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useApi(apiFn, options = {}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(...args);
      setData(res.data.data);
      if (options.successMessage) toast.success(options.successMessage);
      if (options.onSuccess) options.onSuccess(res.data.data);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong';
      setError(msg);
      if (options.showError !== false) toast.error(msg);
      if (options.onError) options.onError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFn, options.successMessage]);

  return { execute, loading, data, error };
}

export function downloadBlob(data, filename) {
  const url = window.URL.createObjectURL(new Blob([data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
