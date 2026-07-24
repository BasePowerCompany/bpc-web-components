export type AddressResult = {
	formattedAddress: string;
	address: {
		line1: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
		latitude?: number;
		longitude?: number;
		externalId?: string;
	};
};

export type ParsedGoogleAddressComponents = {
	line1: string;
	line2: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	latitude?: number;
	longitude?: number;
};

export type RedirectMultipleOption = {
	name: string;
	redirectUrl: string;
	value: string;
};

export type RedirectMultiple = {
	options: RedirectMultipleOption[];
};

export type RedirectMultipleAddress = {
	originalAddress: AddressResult;
	existingAddress: AddressResult;
};

export type RedirectStrategySingleUtility = {
	redirectUrl: string;
	isMultiple: false;
	isMultipleAddresses: false;
	/**
	 * Serving utility for the address (e.g. "ONCOR", "CENTERPOINT"), when the
	 * address-router returns it. Optional: absent on backends that don't yet
	 * surface it, in which case deregulated-utility experiments (see
	 * ./planReveal) treat the address as ineligible and behavior is unchanged.
	 */
	utility?: string;
};

export type RedirectStrategyMultipleUtility = {
	redirectUrl: string;
	multiple: RedirectMultiple;
	isMultiple: true;
	isMultipleAddresses: false;
};

export type RedirectStrategyMultipleAddress = {
	redirectUrl: string;
	isMultiple: false;
	isMultipleAddresses: true;
	multipleAddresses: RedirectMultipleAddress;
};

export type RedirectStrategy =
	| RedirectStrategySingleUtility
	| RedirectStrategyMultipleUtility
	| RedirectStrategyMultipleAddress;

export type HydrationResult =
	| {
			success: true;
			data: {
				redirectUrl: string;
				redirectStrategy: RedirectStrategy;
				externalAddressId: string;
			};
	  }
	| {
			success: false;
			error: string;
	  };

export type ZipRedirectStrategy =
	| { redirectUrl: string; isMultiple: false; utility: string }
	| { redirectUrl: string; isMultiple: true; multiple: RedirectMultiple };

export type ZipRoutingResult =
	| {
			success: true;
			data: {
				redirectUrl: string;
				redirectStrategy: ZipRedirectStrategy;
			};
	  }
	| {
			success: false;
			error: string;
	  };
