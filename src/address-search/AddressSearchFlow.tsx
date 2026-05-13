import { useCallback, useState } from "react";
import {
	type AddressValidationInput,
	type AddressValidationResult,
	validateAddress,
	validationEventProperties,
} from "@/address-search/addressValidation";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";
import {
	parseAddress,
	parseGoogleAddressComponents,
	posthogCapture,
} from "@/address-search/utils";
import { Autocomplete, type Result } from "./Autocomplete";
import { useAddressAutocomplete } from "./useAddressAutocomplete";

type AddressSearchFlowProps = {
	placeholder: string;
	cta?: string;
	portalRoot: ShadowRoot;
	zIndex: number;
	inputValue: string;
	onInputValueChange: (value: string) => void;
	onSubmitSelection: (detail: {
		selection: AddressResult | undefined;
		confirmAddress: boolean;
		validationSessionId?: string;
	}) => void;
	onRequiresAddressConfirm: (data: {
		selection: AddressResult;
		googleAddressComponents: ParsedGoogleAddressComponents;
		validationResult: AddressValidationResult;
		validationSessionId: string;
	}) => void;
	onRequiresUnitRequirementConfirm: (data: {
		selection: AddressResult;
		googleAddressComponents: ParsedGoogleAddressComponents;
		validationResult: AddressValidationResult;
		validationSessionId: string;
	}) => void;
};

function createValidationSessionId(): string {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function toAddressValidationInput(
	place: google.maps.places.Place,
	fallbackAddressLine: string,
): AddressValidationInput {
	const components = parseGoogleAddressComponents(place);
	if (!components?.line1) return fallbackAddressLine;

	return {
		addressLines: [
			[components.line1, components.line2].filter(Boolean).join(" "),
		],
		locality: components.city || undefined,
		administrativeArea: components.state || undefined,
		postalCode: components.postalCode || undefined,
	};
}

/**
 * Shared address entry + resolve + validate flow. Used by both the battery
 * and energy-only variants — the only variant-specific bit is the default
 * placeholder, which the parent supplies.
 */
export function AddressSearchFlow({
	placeholder,
	cta,
	portalRoot,
	zIndex,
	inputValue,
	onInputValueChange,
	onSubmitSelection,
	onRequiresAddressConfirm,
	onRequiresUnitRequirementConfirm,
}: AddressSearchFlowProps) {
	const [validating, setValidating] = useState(false);
	const { results, resolveSelection } = useAddressAutocomplete(inputValue);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const fullText = [result.mainText ?? "", result.secondaryText ?? ""]
				.filter(Boolean)
				.join(", ");
			const validationSessionId = createValidationSessionId();
			onInputValueChange(fullText);
			setValidating(true);

			let resolved: Awaited<ReturnType<typeof resolveSelection>>;
			let validationResult: AddressValidationResult | undefined;
			try {
				resolved = await resolveSelection({ result });
				if (resolved?.place) {
					validationResult = await validateAddress(
						toAddressValidationInput(resolved.place, fullText),
					);
				}
			} finally {
				setValidating(false);
			}

			if (!resolved?.place || !validationResult) return;

			// Parse with Validation API's locality as a fallback — Places omits
			// `locality` for CDPs like Cypress, TX, and we don't want to leak
			// a county name into the city field. See utils.ts `resolveCity`.
			const parseOptions = {
				cityFallback: validationResult.validatedLocality,
			};
			const selection = parseAddress(resolved.place, parseOptions);
			const googleAddressComponents = parseGoogleAddressComponents(
				resolved.place,
				parseOptions,
			);

			if (!selection) return;

			if (
				validationResult.kind === "confirm_unit_requirement" &&
				googleAddressComponents
			) {
				onRequiresUnitRequirementConfirm({
					selection,
					googleAddressComponents,
					validationResult,
					validationSessionId,
				});
				return;
			}

			if (validationResult.kind !== "accept" && googleAddressComponents) {
				onRequiresAddressConfirm({
					selection,
					googleAddressComponents,
					validationResult,
					validationSessionId,
				});
				return;
			}

			posthogCapture("address_validation_result", {
				...validationEventProperties(validationResult, validationSessionId),
				inputFormattedAddress: fullText,
				confirmation_path: "silent",
			});
			onSubmitSelection({
				selection,
				confirmAddress: true,
				validationSessionId,
			});
		},
		[
			onInputValueChange,
			onRequiresAddressConfirm,
			onRequiresUnitRequirementConfirm,
			onSubmitSelection,
			resolveSelection,
		],
	);

	const handleInputChange = useCallback(
		(value: string) => {
			onInputValueChange(value);
		},
		[onInputValueChange],
	);

	return (
		<Autocomplete
			zIndex={zIndex}
			value={inputValue}
			onChange={handleInputChange}
			results={results}
			onSelect={handleSelect}
			placeholder={placeholder}
			cta={cta}
			portalRoot={portalRoot}
			loading={validating}
		/>
	);
}
