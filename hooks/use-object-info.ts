import { useState, useEffect } from 'react';
import type { ComfyObjectInfo } from '@/lib/workflow-api-parser';

interface UseObjectInfoResult {
    objectInfo: ComfyObjectInfo | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
}

export function useObjectInfo(): UseObjectInfoResult {
    const [objectInfo, setObjectInfo] = useState<ComfyObjectInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchObjectInfo = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/comfy/object-info');

            if (!response.ok) {
                throw new Error(`Failed to fetch object info: ${response.status}`);
            }

            const data = await response.json();
            setObjectInfo(data);
        } catch (err) {
            console.error("Error fetching object info:", err);
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchObjectInfo();
    }, []);

    return {
        objectInfo,
        loading,
        error,
        refetch: fetchObjectInfo
    };
}
