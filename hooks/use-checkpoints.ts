import { useState, useEffect } from 'react';

interface UseCheckpointsResult {
    checkpoints: string[];
    loading: boolean;
    error: Error | null;
    refetch: () => void;
}

export function useCheckpoints(): UseCheckpointsResult {
    const [checkpoints, setCheckpoints] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchCheckpoints = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/comfy/checkpoints');

            if (!response.ok) {
                throw new Error(`Failed to fetch checkpoints: ${response.status}`);
            }

            const data = await response.json();
            setCheckpoints(data.checkpoints || []);
        } catch (err) {
            console.error("Error fetching checkpoints:", err);
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCheckpoints();
    }, []);

    return {
        checkpoints,
        loading,
        error,
        refetch: fetchCheckpoints
    };
}
