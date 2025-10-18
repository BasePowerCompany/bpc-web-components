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

export type HydrationResult =
	| {
			success: true;
			data: {
				redirectUrl: string;
			};
	  }
	| {
			success: false;
			error: string;
	  };
