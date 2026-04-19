import type { AddressValidationKind } from "@/address-search/addressValidation";

/**
 * User-facing copy for the address confirm modal, keyed by kind.
 *
 * Each entry is a partial override on top of `DEFAULT_COPY`. The full copy
 * object is produced by `copyFor(kind, unconfirmedComponentTypes)` below.
 * The `unconfirmedComponentTypes` argument only matters for
 * `confirm_components`, where we name the specific component(s) we couldn't
 * verify ("this city" / "the street name and ZIP code").
 *
 * Keeping copy in its own file makes it easy to audit, translate, or tweak
 * wording without touching the modal's structure.
 */

export type BannerTone = "warn" | "error";

export type Banner = {
	tone: BannerTone;
	text: string;
};

export type SecondaryAction = {
	label: string;
	/** If true, the secondary action clears line_2 before submitting. */
	clearsLine2: boolean;
};

export type Copy = {
	title: string;
	banner?: Banner;
	line2Placeholder: string;
	continueLabel: string;
	secondaryAction?: SecondaryAction;
};

const DEFAULT_COPY: Copy = {
	title: "Confirm your address",
	line2Placeholder: "Apartment, unit, or structure (optional)",
	continueLabel: "Continue",
};

/** Kind-specific overrides. Shallow-merged onto `DEFAULT_COPY`. */
const COPY_BY_KIND: Partial<Record<AddressValidationKind, Partial<Copy>>> = {
	missing_subpremise: {
		title: "Confirm your unit number",
		banner: {
			tone: "warn",
			text: "This looks like a multi-unit building. Add your unit or confirm it's a single-family home.",
		},
		line2Placeholder: "Apartment or unit number",
		secondaryAction: {
			label: "This is a single-family home",
			clearsLine2: true,
		},
	},
	confirm_subpremise: {
		title: "Confirm your unit or meter detail",
		banner: {
			tone: "warn",
			text: "We couldn't verify this address & unit. Please edit or confirm below.",
		},
		line2Placeholder: "Apartment, unit, or structure (e.g., guest house, barn)",
		continueLabel: "Confirm",
	},
	confirm_street_number: {
		banner: {
			tone: "warn",
			text: "We couldn't verify this with USPS. If this is correct, confirm below.",
		},
		continueLabel: "Confirm",
	},
	confirm_components: {
		// Banner text is filled in by copyFor based on which components are
		// unconfirmed. This default is only shown if types are missing.
		banner: {
			tone: "warn",
			text: "We couldn't verify this address. Please edit, or confirm to continue.",
		},
		continueLabel: "Confirm",
	},
	block: {
		title: "We couldn't find this address",
		banner: {
			tone: "error",
			text: "Please edit the address and try again.",
		},
	},
};

/** Maps Google component types to user-facing labels. */
const COMPONENT_LABELS: Record<string, string> = {
	route: "street name",
	locality: "city",
	sublocality: "city",
	administrative_area_level_1: "state",
	postal_code: "ZIP code",
};

/** Order components in the banner sentence the way users read the form. */
const COMPONENT_ORDER = [
	"route",
	"locality",
	"sublocality",
	"administrative_area_level_1",
	"postal_code",
];

function describeComponents(types: string[]): string {
	const labels: string[] = [];
	const seen = new Set<string>();
	for (const t of COMPONENT_ORDER) {
		if (!types.includes(t)) continue;
		const label = COMPONENT_LABELS[t];
		if (label && !seen.has(label)) {
			seen.add(label);
			labels.push(label);
		}
	}
	if (labels.length === 0) return "this address";
	if (labels.length === 1) return `this ${labels[0]}`;
	if (labels.length === 2) return `the ${labels[0]} and ${labels[1]}`;
	return `the ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function copyFor(
	kind: AddressValidationKind,
	unconfirmedComponentTypes: string[] = [],
): Copy {
	const base: Copy = { ...DEFAULT_COPY, ...(COPY_BY_KIND[kind] ?? {}) };
	if (kind === "confirm_components") {
		base.banner = {
			tone: "warn",
			text: `We couldn't verify ${describeComponents(unconfirmedComponentTypes)}. Please edit, or confirm to continue.`,
		};
	}
	return base;
}
