/**
 * The single internal address shape used across the address-search UI.
 *
 * `line1` is the street line (street number + route) and `line2` is the unit
 * line (subpremise) — kept separate so the confirm modal can edit each
 * independently. At the HTTP boundary, `toSubmittedAddress` in `utils.ts`
 * folds `line1` + `line2` into a single joined `line1` string because the
 * backend at `/api/address-router` has no concept of `line2`.
 *
 * `line2` is optional because backend hydration responses (e.g. the addresses
 * inside `RedirectMultipleAddress`) arrive with the unit already folded into
 * `line1` and no separate `line2` field. Those responses satisfy this type
 * with `line2` absent, and `toSubmittedAddress` treats that as empty.
 */
export type AddressResult = {
	formattedAddress: string;
	address: {
		line1: string;
		line2?: string;
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
