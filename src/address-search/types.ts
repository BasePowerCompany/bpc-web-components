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
