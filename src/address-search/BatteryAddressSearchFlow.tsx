import { useCallback, useState } from "react";
import type { AddressResult } from "@/address-search/types";
import { Autocomplete, type Result } from "./Autocomplete";
import { useAddressAutocomplete } from "./useAddressAutocomplete";

type BatteryAddressSearchFlowProps = {
	placeholder?: string;
	cta?: string;
	portalRoot: ShadowRoot;
	zIndex: number;
	onSubmitSelection: (detail: {
		selection: AddressResult | undefined;
		confirmAddress: boolean;
	}) => void;
};

export function BatteryAddressSearchFlow({
	placeholder,
	cta,
	portalRoot,
	zIndex,
	onSubmitSelection,
}: BatteryAddressSearchFlowProps) {
	const [inputValue, setInputValue] = useState("");
	const { results, resolveSelection } = useAddressAutocomplete(inputValue);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			setInputValue(
				[result.mainText ?? "", result.secondaryText ?? ""]
					.filter(Boolean)
					.join(", "),
			);
			const resolved = await resolveSelection({ result });
			if (!resolved?.selection) return;
			onSubmitSelection({
				selection: resolved.selection,
				confirmAddress: true,
			});
		},
		[onSubmitSelection, resolveSelection],
	);

	return (
		<Autocomplete
			zIndex={zIndex}
			value={inputValue}
			onChange={setInputValue}
			results={results}
			onSelect={handleSelect}
			placeholder={placeholder || "Enter your home address"}
			cta={cta}
			portalRoot={portalRoot}
		/>
	);
}
