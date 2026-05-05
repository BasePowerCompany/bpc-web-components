import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AddressValidationResult } from "@/address-search/addressValidation";
import { AddressConfirmModal } from "@/address-search/modal/AddressConfirmModal";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";

const selection: AddressResult = {
	formattedAddress: "12550 Piping Rock Drive, Houston, TX 77077, USA",
	address: {
		line1: "12550 Piping Rock Drive",
		city: "Houston",
		state: "TX",
		postalCode: "77077",
		country: "US",
		latitude: 29.7351,
		longitude: -95.6054,
	},
};

const googleAddressComponents: ParsedGoogleAddressComponents = {
	line1: "12550 Piping Rock Drive",
	line2: "",
	city: "Houston",
	state: "TX",
	postalCode: "77077",
	country: "US",
	latitude: 29.7351,
	longitude: -95.6054,
};

const missingSubpremiseValidation: AddressValidationResult = {
	kind: "missing_subpremise",
	unconfirmedComponentTypes: [],
	missingComponentTypes: ["subpremise"],
	unconfirmedFields: ["line2"],
	possibleNextAction: "CONFIRM_ADD_SUBPREMISES",
	addressComplete: true,
	hasUnconfirmedComponents: false,
	hasInferredComponents: false,
	hasReplacedComponents: false,
	dpvConfirmation: "D",
	dpvFootnote: null,
	googleFormattedAddress:
		"12550 Piping Rock Drive, Houston, TX 77077-2400, USA",
	validatedLocality: "Houston",
};

function renderModal(
	props: Partial<React.ComponentProps<typeof AddressConfirmModal>> = {},
) {
	const onContinue = vi.fn();
	const onClose = vi.fn();
	render(
		<AddressConfirmModal
			selection={selection}
			googleAddressComponents={googleAddressComponents}
			validationResult={missingSubpremiseValidation}
			loading={false}
			onContinue={onContinue}
			onClose={onClose}
			{...props}
		/>,
	);

	return { onContinue, onClose };
}

describe("AddressConfirmModal", () => {
	it("blocks missing_subpremise continuation until a unit is entered", async () => {
		const user = userEvent.setup();
		const { onContinue } = renderModal();

		await vi.waitFor(() => {
			expect(
				screen.getByPlaceholderText("Apartment or unit number"),
			).toHaveFocus();
		});
		expect(
			screen.queryByText("This is a single-family home"),
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(onContinue).not.toHaveBeenCalled();
		expect(
			screen.getByText("Please enter your apartment or unit number"),
		).toBeVisible();
		await vi.waitFor(() => {
			expect(
				screen.getByPlaceholderText("Apartment or unit number"),
			).toHaveFocus();
		});
	});

	it("submits the selected multifamily address only after unit entry", async () => {
		const user = userEvent.setup();
		const { onContinue } = renderModal();

		fireEvent.input(screen.getByPlaceholderText("Apartment or unit number"), {
			target: { value: "23" },
		});
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(onContinue).toHaveBeenCalledWith({
			formattedAddress: "12550 Piping Rock Drive 23, Houston, TX 77077, US",
			address: {
				line1: "12550 Piping Rock Drive 23",
				city: "Houston",
				state: "TX",
				postalCode: "77077",
				country: "US",
				latitude: 29.7351,
				longitude: -95.6054,
			},
		});
	});
});
