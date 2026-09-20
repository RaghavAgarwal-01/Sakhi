import { useCallback, useEffect, useRef, useState } from "react";
import { startSiren, stopSiren } from "../utils/siren";

const WS_URL = import.meta.env.VITE_WS_URL;

export function useSakhiSocket() {
  const [incidents, setIncidents] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    if (!WS_URL) {
      console.warn("VITE_WS_URL is not set — the dashboard will not receive live dispatches.");
      return;
    }

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      retryCountRef.current = 0;
    };

    socket.onclose = () => {
      setConnected(false);
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 15000);
      retryCountRef.current += 1;
      setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket.close();
    };

    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type !== "ACTIVE_EMERGENCY_DISPATCH") return;

      setIncidents((prev) => {
        if (prev.some((incident) => incident.incidentId === payload.incidentId)) {
          return prev;
        }
        return [{ ...payload, receivedAt: Date.now(), acknowledged: false }, ...prev];
      });
    };
  }, []);

  useEffect(() => {
    connect();
    return () => socketRef.current?.close();
  }, [connect]);

  useEffect(() => {
    const hasUnacknowledged = incidents.some((incident) => !incident.acknowledged);
    if (hasUnacknowledged) {
      startSiren();
    } else {
      stopSiren();
    }
  }, [incidents]);

  const acknowledge = useCallback((incidentId) => {
    setIncidents((prev) =>
      prev.map((incident) =>
        incident.incidentId === incidentId ? { ...incident, acknowledged: true } : incident
      )
    );
  }, []);

  return { incidents, connected, acknowledge };
}
