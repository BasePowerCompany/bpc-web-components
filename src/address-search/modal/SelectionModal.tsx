import type {
	AddressResult,
	RedirectMultipleAddress,
	RedirectMultipleOption,
} from "@/address-search/types";
import { AddressSelectionModal } from "./AddressSelectionModal";
import { UtilitySelectionModal } from "./UtilitySelectionModal";

export type SelectionModalProps = {
	address: string;
	externalAddressId: string;
	multipleAddressOptions: RedirectMultipleAddress | undefined;
	multipleUtilityOptions: RedirectMultipleOption[] | undefined;
	onSelectAddress: (address: AddressResult) => void;
	onTriggerRedirect: (redirectUrl: string) => void;
	onBack: () => void;
};

export function SelectionModal({
	address,
	externalAddressId,
	multipleAddressOptions,
	multipleUtilityOptions,
	onSelectAddress,
	onTriggerRedirect,
	onBack,
}: SelectionModalProps) {
	console.log("multipleAddressOptions", multipleAddressOptions);
	console.log("multipleUtilityOptions", multipleUtilityOptions);
	// Address selection takes priority over utility selection
	if (multipleAddressOptions) {
		return (
			<AddressSelectionModal
				address={address}
				addressOptions={multipleAddressOptions}
				onSelectAddress={onSelectAddress}
				onBack={onBack}
			/>
		);
	}

	if (multipleUtilityOptions) {
		return (
			<UtilitySelectionModal
				address={address}
				externalAddressId={externalAddressId}
				utilityOptions={multipleUtilityOptions}
				onTriggerRedirect={onTriggerRedirect}
				onBack={onBack}
			/>
		);
	}

	return null;
}
