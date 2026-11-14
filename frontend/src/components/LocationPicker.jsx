import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

const BENGALURU = [12.9716, 77.5946];

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 0.65 });
  }, [center, map]);
  return null;
}

function ClickToChoose({ onChoose }) {
  useMapEvents({
    click(event) {
      onChoose({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

export default function LocationPicker({ location, onChoose }) {
  const center = location ? [location.latitude, location.longitude] : BENGALURU;

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="location-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} />
        <ClickToChoose onChoose={onChoose} />
        {location && <CircleMarker center={center} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#17594d", fillOpacity: 1 }} />}
      </MapContainer>
    </div>
  );
}
