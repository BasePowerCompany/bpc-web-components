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

export type RedirectMultiple = {
  options: { name: string; redirectUrl: string; value: string }[];
};

export type RedirectStrategySingle = {
  redirectUrl: string;
  isMultiple: false;
};

export type RedirectStrategyMultiple = {
  redirectUrl: string;
  multiple: RedirectMultiple;
  isMultiple: true;
};

export type RedirectStrategy =
  | RedirectStrategySingle
  | RedirectStrategyMultiple;

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
