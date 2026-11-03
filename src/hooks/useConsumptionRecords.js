import { useCallback, useEffect, useState } from "react";
import api from "../api";

export default function useConsumptionRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/consumption");
      setRecords(response.data.records);
    } catch (requestError) {
      console.error("Unable to load consumption records:", requestError);
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data?.error ||
          "Unable to load consumption records. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api.get("/api/consumption")
      .then((response) => {
        if (active) setRecords(response.data.records);
      })
      .catch((requestError) => {
        console.error("Unable to load consumption records:", requestError);
        if (active) {
          setError(
            requestError.response?.data?.message ||
              requestError.response?.data?.error ||
              "Unable to load consumption records. Check that the backend is running."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { records, setRecords, loading, error, refresh };
}
