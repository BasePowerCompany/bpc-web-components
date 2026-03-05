import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { fetchHydration } from "@/address-search/fetch";
import { SelectionModal } from "@/address-search/modal/SelectionModal";
import type {
	AddressResult,
	RedirectMultipleAddress,
	RedirectStrategyMultipleUtility,
} from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import { AddressSearch } from "./AddressSearch";

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
					});

					if (isEnergyOnly) {
						// Show splash screen before redirecting
						setMultipleAddressResults(undefined);
						setMultipleUtilityResult(undefined);
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

	return (
		<>
			<AddressSearch
				placeholder={placeholder}
				cta={cta}
				zIndex={zIndex}
				onSelect={(detail) => {
					// the first time user selects address from AddressSearch
					// we always want to confirm the address
					handleSelect({ ...detail, confirmAddress: true });
				}}
				portalRoot={portalRoot}
			/>
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
