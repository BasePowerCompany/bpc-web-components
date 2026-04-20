import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import type { AddressValidationResult } from "@/address-search/addressValidation";
import { fetchHydration } from "@/address-search/fetch";
import { AddressConfirmModal } from "@/address-search/modal/AddressConfirmModal";
import { SelectionModal } from "@/address-search/modal/SelectionModal";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
	RedirectMultipleAddress,
	RedirectStrategyMultipleUtility,
} from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import { AddressSearchFlow } from "./AddressSearchFlow";

type ModalState =
	| { kind: "idle" }
	| {
			kind: "multipleUtility";
			data: {
				redirectUrl: string;
				redirectStrategy: RedirectStrategyMultipleUtility;
				externalAddressId: string;
			};
	  }
	| { kind: "multipleAddress"; data: RedirectMultipleAddress }
	| { kind: "energySplash"; redirectUrl: string };

export type AddressSearchAppProps = {
	placeholder?: string;
	cta?: string;
	isEnergyOnly: boolean;
	portalRoot: ShadowRoot;
	zIndex: number;
	onSelectEvent: (detail: {
		selection: AddressResult | undefined;
		confirmAddress: boolean;
	}) => void;
	onResultEvent: (detail: {
		result: { redirectUrl: string; [key: string]: unknown };
		selection: AddressResult;
	}) => void;
	onErrorEvent: (detail: { error: string }) => void;
};

export function AddressSearchApp({
	placeholder,
	cta,
	isEnergyOnly,
	portalRoot,
	zIndex,
	onSelectEvent,
	onResultEvent,
	onErrorEvent,
}: AddressSearchAppProps) {
	const [selection, setSelection] = useState<AddressResult | undefined>();
	const [externalAddressId, setExternalAddressId] = useState<
		string | undefined
	>();
	const [modalState, setModalState] = useState<ModalState>({ kind: "idle" });
	const [addressConfirmData, setAddressConfirmData] = useState<
		| {
				selection: AddressResult;
				googleAddressComponents: ParsedGoogleAddressComponents;
				validationResult: AddressValidationResult;
		  }
		| undefined
	>();
	// Lifted from the flow so modal edits can sync back into the autocomplete
	// input after the user clicks Confirm.
	const [inputValue, setInputValue] = useState("");

	const handleSelect = useCallback(
		async (detail: {
			selection: AddressResult | undefined;
			confirmAddress: boolean;
		}) => {
			setSelection(detail.selection);

			// Fire the select event to the parent
			onSelectEvent(detail);

			// If no selection, return
			if (!detail.selection) return;

			// Fetch the hydration data
			const result = await fetchHydration(
				detail.selection,
				detail.confirmAddress,
				isEnergyOnly,
			);
			if (result.success) {
				setExternalAddressId(result.data.externalAddressId);
				if (result.data.redirectStrategy.isMultiple) {
					const utilityData = {
						redirectUrl: result.data.redirectUrl,
						redirectStrategy: result.data.redirectStrategy,
						externalAddressId: result.data.externalAddressId,
					};
					setModalState({ kind: "multipleUtility", data: utilityData });
					posthogCapture("address_search_multiple_utility_result", {
						selection: detail.selection,
						multipleResult: utilityData,
					});
					return;
				} else if (result.data.redirectStrategy.isMultipleAddresses) {
					setModalState({
						kind: "multipleAddress",
						data: result.data.redirectStrategy.multipleAddresses,
					});
					posthogCapture("address_search_multiple_address_result", {
						selection: detail.selection,
						multipleResult: result.data.redirectStrategy.multipleAddresses,
					});
					return;
				} else {
					// fetchHydration returns single result success, dispatch to parent
					posthogCapture("address_search_single_result", {
						selection: detail.selection,
						externalAddressId: result.data.externalAddressId,
					});

					if (isEnergyOnly) {
						setAddressConfirmData(undefined);
						setModalState({
							kind: "energySplash",
							redirectUrl: result.data.redirectUrl,
						});
						return;
					}

					onResultEvent({
						result: result.data,
						selection: detail.selection,
					});
				}
			} else {
				// fetchHydration failed, dispatch error to parent
				posthogCapture("address_search_no_result", {
					selection: detail.selection,
					error: result.error,
				});
				onErrorEvent({ error: result.error });
			}
		},
		[isEnergyOnly, onSelectEvent, onResultEvent, onErrorEvent],
	);

	const handleRedirect = useCallback(
		(redirectUrl: string) => {
			if (!selection) return;
			// Dispatch the result event to route the user to redirectUrl
			onResultEvent({
				result: { redirectUrl, externalAddressId: externalAddressId ?? "" },
				selection,
			});
		},
		[onResultEvent, selection, externalAddressId],
	);

	const handleUserSelectAddress = useCallback(
		(address: AddressResult) => {
			// when user selects an address from the AddressSelectionContent
			// we don't want to confirm the address, user will be redirected
			handleSelect({ selection: address, confirmAddress: false });
		},
		[handleSelect],
	);

	const handleRequiresAddressConfirm = useCallback(
		(data: {
			selection: AddressResult;
			googleAddressComponents: ParsedGoogleAddressComponents;
			validationResult: AddressValidationResult;
		}) => {
			setAddressConfirmData(data);
		},
		[],
	);

	const [addressConfirmLoading, setAddressConfirmLoading] = useState(false);

	const handleAddressConfirmContinue = useCallback(
		async (result: AddressResult) => {
			setAddressConfirmLoading(true);
			// Sync the autocomplete input with whatever the user edited in the
			// modal so there's no stale address visible while hydration runs.
			setInputValue(result.formattedAddress);
			try {
				await handleSelect({ selection: result, confirmAddress: true });
			} finally {
				setAddressConfirmData(undefined);
				setAddressConfirmLoading(false);
			}
		},
		[handleSelect],
	);

	const handleAddressConfirmClose = useCallback(() => {
		setAddressConfirmData(undefined);
	}, []);

	const handleBack = useCallback(() => {
		setModalState({ kind: "idle" });
		setSelection(undefined);
		setExternalAddressId(undefined);
	}, []);

	const shouldShowModal = modalState.kind !== "idle";

	const resolvedPlaceholder =
		placeholder ||
		(isEnergyOnly ? "Street address" : "Enter your home address");

	return (
		<>
			<AddressSearchFlow
				placeholder={resolvedPlaceholder}
				cta={cta}
				zIndex={zIndex}
				portalRoot={portalRoot}
				inputValue={inputValue}
				onInputValueChange={setInputValue}
				onSubmitSelection={handleSelect}
				onRequiresAddressConfirm={handleRequiresAddressConfirm}
			/>
			{addressConfirmData &&
				createPortal(
					<AddressConfirmModal
						selection={addressConfirmData.selection}
						googleAddressComponents={addressConfirmData.googleAddressComponents}
						validationResult={addressConfirmData.validationResult}
						loading={addressConfirmLoading}
						onContinue={handleAddressConfirmContinue}
						onClose={handleAddressConfirmClose}
					/>,
					portalRoot,
				)}
			{shouldShowModal &&
				createPortal(
					<SelectionModal
						address={selection?.formattedAddress ?? ""}
						externalAddressId={externalAddressId ?? ""}
						multipleAddressOptions={
							modalState.kind === "multipleAddress"
								? modalState.data
								: undefined
						}
						multipleUtilityOptions={
							modalState.kind === "multipleUtility"
								? modalState.data.redirectStrategy.multiple.options
								: undefined
						}
						energySplashRedirectUrl={
							modalState.kind === "energySplash"
								? modalState.redirectUrl
								: undefined
						}
						onSelectAddress={handleUserSelectAddress}
						onTriggerRedirect={handleRedirect}
						onBack={handleBack}
					/>,
					portalRoot,
				)}
		</>
	);
}
