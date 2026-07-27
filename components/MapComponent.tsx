'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  Polygon,
  StandaloneSearchBox,
} from '@react-google-maps/api';
import type { LatLng } from '@/lib/staticMap';

// Deliberately no 'drawing' library here - Google removed the
// google.maps.drawing.DrawingManager class from the Maps JavaScript API as
// of v3.65 (https://developers.google.com/maps/deprecations), so any app
// still requesting it crashes at runtime. Polygon tracing below is
// implemented by hand: tap the map to add vertices, tap "Finish Shape" to
// close it - Google's own recommended replacement approach.
const LIBRARIES: ('geometry' | 'places')[] = ['geometry', 'places'];

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const DEFAULT_CENTER = { lat: 30.2672, lng: -97.7431 };

const POLYGON_OPTIONS = {
  fillColor: '#3b82f6',
  fillOpacity: 0.25,
  strokeColor: '#2563eb',
  strokeWeight: 3,
  clickable: true,
  editable: true,
  draggable: true,
  zIndex: 1,
};

const VERTEX_ICON = {
  path: 0, // google.maps.SymbolPath.CIRCLE - a stable enum value (0), used
  // directly so this object doesn't need window.google to exist yet.
  scale: 5,
  fillColor: '#2563eb',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 1.5,
};

interface MapComponentProps {
  onAreaCalculated: (sqFt: number) => void;
  onPolygonChange: (path: LatLng[] | null) => void;
}

export default function MapComponent({ onAreaCalculated, onPolygonChange }: MapComponentProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const [polygonPath, setPolygonPath] = useState<google.maps.LatLngLiteral[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<google.maps.LatLngLiteral[]>([]);

  const calculateArea = useCallback(
    (path: google.maps.LatLngLiteral[]) => {
      if (!window.google?.maps?.geometry?.spherical || path.length < 3) return;
      const poly = new window.google.maps.Polygon({ paths: path });
      const areaSqMeters = window.google.maps.geometry.spherical.computeArea(poly.getPath());
      const areaSqFeet = areaSqMeters * 10.7639;
      onAreaCalculated(Math.round(areaSqFeet));
      onPolygonChange(path);
    },
    [onAreaCalculated, onPolygonChange]
  );

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!isDrawing || !e.latLng) return;
      setDrawingPoints((prev) => [...prev, { lat: e.latLng!.lat(), lng: e.latLng!.lng() }]);
    },
    [isDrawing]
  );

  const onPolygonEdited = useCallback(
    (polygonInstance: google.maps.Polygon) => {
      const path = polygonInstance.getPath().getArray().map((latLng) => ({
        lat: latLng.lat(),
        lng: latLng.lng(),
      }));
      setPolygonPath(path);
      calculateArea(path);
    },
    [calculateArea]
  );

  const onPlacesChanged = useCallback(() => {
    const places = searchBoxRef.current?.getPlaces();
    if (places && places.length > 0 && mapRef.current) {
      const place = places[0];
      if (place.geometry?.location) {
        mapRef.current.panTo(place.geometry.location);
        mapRef.current.setZoom(20);
      }
    }
  }, []);

  const startDrawing = useCallback(() => {
    setPolygonPath([]);
    setDrawingPoints([]);
    setIsDrawing(true);
    onAreaCalculated(0);
    onPolygonChange(null);
  }, [onAreaCalculated, onPolygonChange]);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setDrawingPoints([]);
  }, []);

  const finishDrawing = useCallback(() => {
    if (drawingPoints.length < 3) return;
    setPolygonPath(drawingPoints);
    calculateArea(drawingPoints);
    setIsDrawing(false);
    setDrawingPoints([]);
  }, [drawingPoints, calculateArea]);

  const undoLastPoint = useCallback(() => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  }, []);

  const clearPolygon = useCallback(() => {
    setPolygonPath([]);
    onAreaCalculated(0);
    onPolygonChange(null);
  }, [onAreaCalculated, onPolygonChange]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-2xl">
        <div className="text-slate-500 text-lg animate-pulse">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-slate-300">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={DEFAULT_CENTER}
        zoom={19}
        mapTypeId="satellite"
        onLoad={(map) => { mapRef.current = map; }}
        onClick={onMapClick}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        }}
      >
        <div className="absolute top-3 left-3 right-3 z-10">
          <StandaloneSearchBox
            onLoad={(ref) => { searchBoxRef.current = ref; }}
            onPlacesChanged={onPlacesChanged}
          >
            <input
              type="text"
              placeholder="Search address..."
              className="w-full px-4 py-3 text-base bg-white/95 backdrop-blur shadow-lg rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </StandaloneSearchBox>
        </div>

        {isDrawing && drawingPoints.length > 0 && (
          <Polyline
            path={drawingPoints}
            options={{ strokeColor: '#2563eb', strokeWeight: 3 }}
          />
        )}

        {isDrawing &&
          drawingPoints.map((point, index) => (
            <Marker key={index} position={point} icon={VERTEX_ICON} />
          ))}

        {polygonPath.length > 0 && (
          <Polygon
            paths={polygonPath}
            options={POLYGON_OPTIONS}
            editable
            draggable
            onLoad={(polygonInstance) => {
              const path = polygonInstance.getPath();
              path.addListener('set_at', () => onPolygonEdited(polygonInstance));
              path.addListener('insert_at', () => onPolygonEdited(polygonInstance));
              path.addListener('remove_at', () => onPolygonEdited(polygonInstance));
            }}
          />
        )}
      </GoogleMap>

      <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-3">
        {isDrawing ? (
          <>
            <button onClick={cancelDrawing} className="flex-1 btn-secondary shadow-lg">
              Cancel
            </button>
            {drawingPoints.length > 0 && (
              <button onClick={undoLastPoint} className="flex-1 btn-secondary shadow-lg">
                Undo Point
              </button>
            )}
            <button
              onClick={finishDrawing}
              disabled={drawingPoints.length < 3}
              className="flex-1 btn-primary shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Finish Shape
            </button>
          </>
        ) : polygonPath.length === 0 ? (
          <button onClick={startDrawing} className="flex-1 btn-primary shadow-lg">
            ✏️ Draw Parking Lot
          </button>
        ) : (
          <>
            <button onClick={clearPolygon} className="flex-1 btn-secondary shadow-lg">
              🗑️ Clear Area
            </button>
            <button onClick={startDrawing} className="flex-1 btn-primary shadow-lg">
              ✏️ Redraw
            </button>
          </>
        )}
      </div>

      {isDrawing && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-bounce">
          {drawingPoints.length < 3
            ? 'Tap the map to place points around the lot'
            : 'Tap Finish Shape when done'}
        </div>
      )}
    </div>
  );
}
