import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
	type AddressValidationResult,
	requireSubpremise,
} from "@/address-search/addressValidation";
import { decorateRedirectUrl } from "@/address-search/decorateRedirectUrl";
import { fetchHydration } from "@/address-search/fetch";
import { AddressConfirmModal } from "@/address-search/modal/AddressConfirmModal";
import { SelectionModal } from "@/address-search/modal/SelectionModal";
import { UnitRequirementPromptModal } from "@/address-search/modal/UnitRequirementPromptModal";
import { maybeWrapInPlanReveal } from "@/address-search/planReveal";
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
		validationSessionId?: string;
	}) => void;
	onResultEvent: (detail: {
		result: { redirectUrl: string; [key: string]: unknown };
		selection: AddressResult;
		validationSessionId?: string;
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
	const [selectionValidationSessionId, setSelectionValidationSessionId] =
		useState<string | undefined>();
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
				validationSessionId: string;
		  }
		| undefined
	>();
	// Lifted from the flow so modal edits can sync back into the autocomplete
	// input after the user clicks Confirm.
	const [inputValue, setInputValue] = useState("");
	const [unitRequirementData, setUnitRequirementData] = useState<
		| {
				selection: AddressResult;
				googleAddressComponents: ParsedGoogleAddressComponents;
				validationResult: AddressValidationResult;
				validationSessionId: string;
		  }
		| undefined
	>();

	const handleSelect = useCallback(
		async (detail: {
			selection: AddressResult | undefined;
			confirmAddress: boolean;
			validationSessionId?: string;
		}) => {
			setSelection(detail.selection);
			setSelectionValidationSessionId(detail.validationSessionId);

			// Fire the select event to the parent
			onSelectEvent(detail);

			// If no selection, return
			if (!detail.selection) return;

			// Funnel parity with zip_search_submit: the user committed an address
			// (router call starts now, results captured separately below).
			posthogCapture("address_search_submit", {
				validationSessionId: detail.validationSessionId,
				selection: detail.selection,
			});

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
						validationSessionId: detail.validationSessionId,
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
						validationSessionId: detail.validationSessionId,
						selection: detail.selection,
						multipleResult: result.data.redirectStrategy.multipleAddresses,
					});
					return;
				} else {
					// fetchHydration returns single result success, dispatch to parent
					posthogCapture("address_search_single_result", {
						validationSessionId: detail.validationSessionId,
						selection: detail.selection,
						externalAddressId: result.data.externalAddressId,
					});

					if (isEnergyOnly) {
						// Show splash screen before redirecting
						setMultipleAddressResults(undefined);
						setMultipleUtilityResult(undefined);
						setAddressConfirmData(undefined);
						setUnitRequirementData(undefined);
						setEnergySplashRedirectUrl(result.data.redirectUrl);
						return;
					}

					// The component is the single source of truth for the funnel URL:
					// decorate every redirect here (a host that also decorates just
					// re-applies the same params idempotently). Then, for a deregulated
					// (Oncor/CenterPoint) address in the test arm, divert to the
					// /plan-reveal interstitial carrying this decorated URL as `next`;
					// control / ineligible / flag-off / utility-absent stay on it.
					const decorated = decorateRedirectUrl(
						result.data.redirectUrl,
						result.data.externalAddressId,
					);
					const redirectUrl = maybeWrapInPlanReveal({
						utility: result.data.redirectStrategy.utility,
						next: decorated,
						city: detail.selection.address.city || undefined,
					});

					// Funnel parity with zip_search_redirect: captured before dispatch
					// so the event isn't lost to the navigation.
					posthogCapture("address_search_redirect", {
						redirectUrl,
						externalAddressId: result.data.externalAddressId,
						validationSessionId: detail.validationSessionId,
					});
					onResultEvent({
						result: { ...result.data, redirectUrl },
						selection: detail.selection,
						validationSessionId: detail.validationSessionId,
					});
				}
			} else {
				// fetchHydration failed, dispatch error to parent
				posthogCapture("address_search_no_result", {
					validationSessionId: detail.validationSessionId,
					selection: detail.selection,
					error: result.error,
				});
				onErrorEvent({ error: result.error });
			}
		},
		[isEnergyOnly, onSelectEvent, onResultEvent, onErrorEvent],
	);

	const handleRedirect = useCallback(
		(rawRedirectUrl: string) => {
			if (!selection) return;
			// Decorate here too, so every address redirect (single-utility, modal,
			// and energy splash) carries the full funnel params from one source of
			// truth. Plan-reveal doesn't apply to these paths (utility isn't known
			// per-option here), so no wrap.
			const redirectUrl = decorateRedirectUrl(
				rawRedirectUrl,
				externalAddressId ?? undefined,
			);
			// Funnel parity with zip_search_redirect (modal/splash paths): captured
			// before dispatch so the event isn't lost to the navigation.
			posthogCapture("address_search_redirect", {
				redirectUrl,
				externalAddressId: externalAddressId ?? "",
				validationSessionId: selectionValidationSessionId,
			});
			// Dispatch the result event to route the user to redirectUrl
			onResultEvent({
				result: { redirectUrl, externalAddressId: externalAddressId ?? "" },
				selection,
				validationSessionId: selectionValidationSessionId,
			});
		},
		[onResultEvent, selection, externalAddressId, selectionValidationSessionId],
	);

	const handleUserSelectAddress = useCallback(
		(address: AddressResult) => {
			// when user selects an address from the AddressSelectionContent
			// we don't want to confirm the address, user will be redirected
			handleSelect({
				selection: address,
				confirmAddress: false,
				validationSessionId: selectionValidationSessionId,
			});
		},
		[handleSelect, selectionValidationSessionId],
	);

	const handleRequiresAddressConfirm = useCallback(
		(data: {
			selection: AddressResult;
			googleAddressComponents: ParsedGoogleAddressComponents;
			validationResult: AddressValidationResult;
			validationSessionId: string;
		}) => {
			setAddressConfirmData(data);
		},
		[],
	);

	const handleRequiresUnitRequirementConfirm = useCallback(
		(data: {
			selection: AddressResult;
			googleAddressComponents: ParsedGoogleAddressComponents;
			validationResult: AddressValidationResult;
			validationSessionId: string;
		}) => {
			setUnitRequirementData(data);
		},
		[],
	);

	const [addressConfirmLoading, setAddressConfirmLoading] = useState(false);
	const [unitRequirementLoading, setUnitRequirementLoading] = useState(false);

	const handleAddressConfirmContinue = useCallback(
		async (result: AddressResult) => {
			if (!addressConfirmData) return;
			setAddressConfirmLoading(true);
			// Sync the autocomplete input with whatever the user edited in the
			// modal so there's no stale address visible while hydration runs.
			setInputValue(result.formattedAddress);
			try {
				await handleSelect({
					selection: result,
					confirmAddress: true,
					validationSessionId: addressConfirmData.validationSessionId,
				});
			} finally {
				setAddressConfirmData(undefined);
				setAddressConfirmLoading(false);
			}
		},
		[addressConfirmData, handleSelect],
	);

	const handleAddressConfirmClose = useCallback(() => {
		setAddressConfirmData(undefined);
	}, []);

	const handleUnitRequirementNeedsUnit = useCallback(() => {
		if (!unitRequirementData) return;
		setUnitRequirementData(undefined);
		setAddressConfirmData({
			...unitRequirementData,
			validationResult: requireSubpremise(unitRequirementData.validationResult),
		});
	}, [unitRequirementData]);

	const handleUnitRequirementNoUnit = useCallback(async () => {
		if (!unitRequirementData) return;
		setUnitRequirementLoading(true);
		try {
			await handleSelect({
				selection: unitRequirementData.selection,
				confirmAddress: true,
				validationSessionId: unitRequirementData.validationSessionId,
			});
		} finally {
			setUnitRequirementData(undefined);
			setUnitRequirementLoading(false);
		}
	}, [handleSelect, unitRequirementData]);

	const handleUnitRequirementClose = useCallback(() => {
		setUnitRequirementData(undefined);
	}, []);

	const handleBack = useCallback(() => {
		setMultipleUtilityResult(undefined);
		setMultipleAddressResults(undefined);
		setSelection(undefined);
		setSelectionValidationSessionId(undefined);
		setExternalAddressId(undefined);
		setEnergySplashRedirectUrl(undefined);
		setAddressConfirmData(undefined);
		setUnitRequirementData(undefined);
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
				onRequiresUnitRequirementConfirm={handleRequiresUnitRequirementConfirm}
			/>
			{unitRequirementData &&
				createPortal(
					<UnitRequirementPromptModal
						selection={unitRequirementData.selection}
						validationResult={unitRequirementData.validationResult}
						validationSessionId={unitRequirementData.validationSessionId}
						loading={unitRequirementLoading}
						onNeedsUnit={handleUnitRequirementNeedsUnit}
						onNoUnit={handleUnitRequirementNoUnit}
						onClose={handleUnitRequirementClose}
					/>,
					portalRoot,
				)}
			{addressConfirmData &&
				createPortal(
					<AddressConfirmModal
						selection={addressConfirmData.selection}
						googleAddressComponents={addressConfirmData.googleAddressComponents}
						validationResult={addressConfirmData.validationResult}
						validationSessionId={addressConfirmData.validationSessionId}
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
