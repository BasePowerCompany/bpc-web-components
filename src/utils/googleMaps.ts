// @ts-nocheck

// This is a modified version of the bootstrap function from the google maps API documentation
// https://developers.google.com/maps/documentation/javascript/libraries

export const bootstrap = (params: {
	key: string;
	v: string;
	libraries?: string[];
}) => {
	window.google = window.google || {};
	window.google.maps = window.google.maps || {};

	if (window.google.maps.importLibrary) {
		return;
	}

	const libraries = new Set(params.libraries || []);
	const searchParams = new URLSearchParams();
	let bootstrapPromise: Promise<void> | null = null;

	const triggerBootstrap = () => {
		if (bootstrapPromise) {
			return bootstrapPromise;
		}

		bootstrapPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			searchParams.set("libraries", Array.from(libraries).join(","));
			for (const bootstrapParamsKey in params) {
				searchParams.set(
					bootstrapParamsKey.replace(/[A-Z]/g, (g) => `_${g[0].toLowerCase()}`),
					params[bootstrapParamsKey],
				);
			}
			searchParams.set("callback", "google.maps.__ib__");
			script.src = `https://maps.googleapis.com/maps/api/js?${searchParams.toString()}`;
			window.google.maps.__ib__ = resolve;
			script.onerror = () => reject(Error("Google Maps could not load."));
			script.nonce = document.querySelector("script[nonce]")?.nonce || "";
			document.head.append(script);
		});

		return bootstrapPromise;
	};

	if (!window.google.maps.importLibrary) {
		window.google.maps.importLibrary = (libraryName, ...args) =>
			libraries.add(libraryName) &&
			triggerBootstrap().then(() =>
				window.google.maps.importLibrary(libraryName, ...args),
			);
	}
};
