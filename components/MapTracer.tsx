"use client";

import { useCallback, useRef, useState } from "react";
import {
  Autocomplete,
  DrawingManager,
  GoogleMap,
  useJsApiLoader,
} from "@react-google-maps/api";
import { squareMetersToSquareFeet } from "@/lib/estimation";
import type { LatLng } from "@/lib/staticMap";

// Every Google Maps "library" (Places, Drawing, Geometry) has to be listed up
// front and passed the *same array reference* on every render - recreating
// this array inline would make useJsApiLoader think the libraries changed and
// reload the whole SDK in a loop. Keep it as a module-level constant.
const GOOGLE_MAPS_LIBRARIES: (
  | "places"
  | "drawing"
  | "geometry"
)[] = ["places", "drawing", "geometry"];

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 }; // continental US center
const DEFAULT_ZOOM = 4;

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

export interface TracedLot {
  path: LatLng[];
  areaSqFt: number;
  center: LatLng;
  zoom: number;
}

interface MapTracerProps {
  apiKey: string;
  onLotTraced: (lot: TracedLot | null) => void;
  onAddressSelected?: (address: string) => void;
}

export default function MapTracer({
  apiKey,
  onLotTraced,
  onAddressSelected,
}: MapTracerProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  const [polygonPath, setPolygonPath] = useState<LatLng[]>([]);
  const [areaSqFt, setAreaSqFt] = useState<number | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onAutocompleteLoad = useCallback(
    (autocomplete: google.maps.places.Autocomplete) => {
      autocompleteRef.current = autocomplete;
    },
    []
  );

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    const location = place?.geometry?.location;
    if (!location || !mapRef.current) return;
    mapRef.current.panTo(location);
    mapRef.current.setZoom(20); // close enough to trace individual parking spaces
    if (place?.formatted_address) {
      onAddressSelected?.(place.formatted_address);
    }
  }, [onAddressSelected]);

  const emitTracedLot = useCallback(
    (path: LatLng[]) => {
      if (path.length < 3 || !mapRef.current) {
        onLotTraced(null);
        return;
      }
      const sqMeters = google.maps.geometry.spherical.computeArea(
        path.map((p) => new google.maps.LatLng(p.lat, p.lng))
      );
      const sqFt = squareMetersToSquareFeet(sqMeters);
      setAreaSqFt(sqFt);

      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      const center = bounds.getCenter();

      onLotTraced({
        path,
        areaSqFt: sqFt,
        center: { lat: center.lat(), lng: center.lng() },
        zoom: mapRef.current.getZoom() ?? DEFAULT_ZOOM,
      });
    },
    [onLotTraced]
  );

  // Reads the live vertex list off the polygon (drag handles move these
  // without firing a fresh "polygoncomplete" event), so edits after drawing
  // still recompute area and refresh the form.
  const readPathFromPolygon = useCallback(() => {
    const polygon = polygonRef.current;
    if (!polygon) return;
    const path: LatLng[] = polygon
      .getPath()
      .getArray()
      .map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));
    setPolygonPath(path);
    emitTracedLot(path);
  }, [emitTracedLot]);

  const onPolygonComplete = useCallback(
    (polygon: google.maps.Polygon) => {
      // Only one traced lot at a time - drop any previous polygon.
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      polygonRef.current = polygon;

      const path = polygon
        .getPath()
        .getArray()
        .map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));
      setPolygonPath(path);
      emitTracedLot(path);

      const mvcPath = polygon.getPath();
      mvcPath.addListener("set_at", readPathFromPolygon);
      mvcPath.addListener("insert_at", readPathFromPolygon);
      mvcPath.addListener("remove_at", readPathFromPolygon);
    },
    [emitTracedLot, readPathFromPolygon]
  );

  const clearPolygon = useCallback(() => {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    setPolygonPath([]);
    setAreaSqFt(null);
    onLotTraced(null);
  }, [onLotTraced]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-800 p-4 text-center text-sm text-red-300">
        Failed to load Google Maps. Check that NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        is set and that the Maps JavaScript, Places, Drawing, and Geometry
        libraries/APIs are enabled for that key.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-800 text-sm text-neutral-300">
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Address search bar (Places Autocomplete) - centers the map, it does
          not place a marker; the estimator still traces the lot by hand. */}
      <div className="absolute left-2 right-2 top-2 z-10">
        <Autocomplete
          onLoad={onAutocompleteLoad}
          onPlaceChanged={onPlaceChanged}
        >
          <input
            type="text"
            placeholder="Search client address..."
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
          />
        </Autocomplete>
      </div>

      {areaSqFt !== null && (
        <div className="absolute bottom-2 left-2 z-10 rounded-md bg-neutral-900/90 px-3 py-2 text-sm font-medium text-lockhart-yellow shadow-md">
          Traced area: {Math.round(areaSqFt).toLocaleString()} sq ft
        </div>
      )}

      <button
        type="button"
        onClick={clearPolygon}
        disabled={polygonPath.length === 0}
        className="absolute bottom-2 right-2 z-10 rounded-md bg-white/95 px-3 py-2 text-sm font-medium shadow-md disabled:opacity-50"
      >
        Clear trace
      </button>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        mapTypeId="satellite"
        onLoad={onMapLoad}
        options={{
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        }}
      >
        <DrawingManager
          onPolygonComplete={onPolygonComplete}
          options={{
            drawingControl: true,
            drawingControlOptions: {
              position: google.maps.ControlPosition.TOP_RIGHT,
              drawingModes: [google.maps.drawing.OverlayType.POLYGON],
            },
            polygonOptions: {
              fillColor: "#f5b400",
              fillOpacity: 0.35,
              strokeColor: "#f5b400",
              strokeWeight: 3,
              editable: true,
              draggable: false,
            },
          }}
        />
      </GoogleMap>
    </div>
  );
}
