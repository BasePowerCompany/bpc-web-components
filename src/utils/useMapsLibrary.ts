import { useEffect, useState } from "react";

interface ApiLibraries {
	core: google.maps.CoreLibrary;
	maps: google.maps.MapsLibrary;
	places: google.maps.PlacesLibrary;
	geocoding: google.maps.GeocodingLibrary;
	routes: google.maps.RoutesLibrary;
	marker: google.maps.MarkerLibrary;
	geometry: google.maps.GeometryLibrary;
	elevation: google.maps.ElevationLibrary;
	streetView: google.maps.StreetViewLibrary;
	journeySharing: google.maps.JourneySharingLibrary;
	drawing: google.maps.DrawingLibrary;
	visualization: google.maps.VisualizationLibrary;
}

export const useMapsLibrary = <
	K extends keyof ApiLibraries,
	V extends ApiLibraries[K],
>(
	name: K,
): V | null => {
	const [library, setLibrary] = useState<V | null>(null);

	useEffect(() => {
		window.google.maps.importLibrary(name).then((lib) => {
			setLibrary(lib as V);
		});
	}, [name]);

	return library;
};
