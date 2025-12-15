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

export type RedirectModal = {
  options: { name: string; redirectUrl: string; value: string }[];
};

type RedirectStrategy =
  | {
      redirectUrl: string;
      isModal: false;
    }
  | {
      redirectUrl: string;
      modal: RedirectModal;
      isModal: true;
    };

export type HydrationResult =
  | {
      success: true;
      data: {
        redirectUrl: string;
        redirectStrategy: RedirectStrategy;
      };
    }
  | {
      success: false;
      error: string;
    };
