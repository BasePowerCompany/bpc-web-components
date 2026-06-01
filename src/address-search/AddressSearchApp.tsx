import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
	type AddressValidationResult,
	requireSubpremise,
} from "@/address-search/addressValidation";
import { fetchHydration } from "@/address-search/fetch";
import { AddressConfirmModal } from "@/address-search/modal/AddressConfirmModal";
import { SelectionModal } from "@/address-search/modal/SelectionModal";
import { UnitRequirementPromptModal } from "@/address-search/modal/UnitRequirementPromptModal";
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
	const [modalState, setModalState] = useState<ModalState>({ kind: "idle" });
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
						validationSessionId: detail.validationSessionId,
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
						setAddressConfirmData(undefined);
						setUnitRequirementData(undefined);
						setModalState({
							kind: "energySplash",
							redirectUrl: result.data.redirectUrl,
						});
						return;
					}

					onResultEvent({
						result: result.data,
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
		(redirectUrl: string) => {
			if (!selection) return;
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
		setModalState({ kind: "idle" });
		setSelection(undefined);
		setSelectionValidationSessionId(undefined);
		setExternalAddressId(undefined);
		setAddressConfirmData(undefined);
		setUnitRequirementData(undefined);
	}, []);

	// `selection` guard prevents a stale in-flight hydration that resolves after
	// handleBack from re-opening the modal with an empty address.
	const shouldShowModal = selection && modalState.kind !== "idle";

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
