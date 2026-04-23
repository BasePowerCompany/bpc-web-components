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
	const [multipleUtilityResult, setMultipleUtilityResult] = useState<
		| {
				redirectUrl: string;
				redirectStrategy: RedirectStrategyMultipleUtility;
				externalAddressId: string;
		  }
		| undefined
	>();
	const [multipleAddressResults, setMultipleAddressResults] = useState<
		RedirectMultipleAddress | undefined
	>();
	const [energySplashRedirectUrl, setEnergySplashRedirectUrl] = useState<
		string | undefined
	>();
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
					// multiple utility result
					setMultipleUtilityResult({
						redirectUrl: result.data.redirectUrl,
						redirectStrategy: result.data.redirectStrategy,
						externalAddressId: result.data.externalAddressId,
					});
					// clear other modal states
					setMultipleAddressResults(undefined);
					setEnergySplashRedirectUrl(undefined);
					posthogCapture("address_search_multiple_utility_result", {
						selection: detail.selection,
						multipleResult: {
							redirectUrl: result.data.redirectUrl,
							redirectStrategy: result.data.redirectStrategy,
							externalAddressId: result.data.externalAddressId,
						},
					});
					return;
				} else if (result.data.redirectStrategy.isMultipleAddresses) {
					// multiple address result
					setMultipleAddressResults(
						result.data.redirectStrategy.multipleAddresses,
					);
					// clear other modal states
					setMultipleUtilityResult(undefined);
					setEnergySplashRedirectUrl(undefined);
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
						// Show splash screen before redirecting
						setMultipleAddressResults(undefined);
						setMultipleUtilityResult(undefined);
						setAddressConfirmData(undefined);
						setEnergySplashRedirectUrl(result.data.redirectUrl);
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
				result: { redirectUrl },
				selection,
			});
		},
		[onResultEvent, selection],
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
		setMultipleUtilityResult(undefined);
		setMultipleAddressResults(undefined);
		setSelection(undefined);
		setExternalAddressId(undefined);
		setEnergySplashRedirectUrl(undefined);
	}, []);

	const shouldShowModal =
		selection &&
		(multipleAddressResults != null ||
			multipleUtilityResult != null ||
			energySplashRedirectUrl != null);

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
						multipleAddressOptions={multipleAddressResults}
						multipleUtilityOptions={
							multipleUtilityResult?.redirectStrategy.multiple.options
						}
						energySplashRedirectUrl={energySplashRedirectUrl}
						onSelectAddress={handleUserSelectAddress}
						onTriggerRedirect={handleRedirect}
						onBack={handleBack}
					/>,
					portalRoot,
				)}
		</>
	);
}
