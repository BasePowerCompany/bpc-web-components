import type { AddressValidationKind } from "@/address-search/addressValidation";

/**
 * User-facing copy for the address confirm modal, keyed by kind.
 *
 * Each entry is a partial override on top of `DEFAULT_COPY`. The full copy
 * object is produced by `copyFor(kind, unconfirmedComponentTypes)` below.
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
			text: "We detected this may be a multi-unit or apartment building. Please add your unit number, or let us know if it's a single-family home.",
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
			text: "We couldn't verify this with USPS — that's okay for separate meters like apartments, guest houses, barns, or trailers. Please confirm it's correct.",
		},
		line2Placeholder: "Apartment, unit, or structure (e.g., guest house, barn)",
		continueLabel: "Confirm",
	},
	confirm_street_number: {
		banner: {
			tone: "warn",
			text: "We couldn't verify this address with USPS — this is common for new builds and rural addresses. Please confirm it's correct.",
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
	// confirm_components has dynamic banner text — see copyFor below.
};

/**
 * Maps Google component types to user-facing labels for the
 * confirm_components banner. Order matches the form fields so the sentence
 * reads naturally ("the street name, city, and ZIP code").
 */
const COMPONENT_LABELS: Record<string, string> = {
	route: "street name",
	locality: "city",
	sublocality: "city",
	administrative_area_level_1: "state",
	postal_code: "ZIP code",
};

const COMPONENT_ORDER = [
	"route",
	"locality",
	"sublocality",
	"administrative_area_level_1",
	"postal_code",
];

function labelsForComponents(types: string[]): string[] {
	const seen = new Set<string>();
	const labels: string[] = [];
	for (const t of COMPONENT_ORDER) {
		if (types.includes(t)) {
			const label = COMPONENT_LABELS[t];
			if (label && !seen.has(label)) {
				seen.add(label);
				labels.push(label);
			}
		}
	}
	return labels;
}

function joinLabels(labels: string[]): string {
	if (labels.length === 0) return "the highlighted fields";
	if (labels.length === 1) return `the ${labels[0]}`;
	if (labels.length === 2) return `the ${labels[0]} and ${labels[1]}`;
	return `the ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function copyFor(
	kind: AddressValidationKind,
	unconfirmedComponentTypes: string[],
): Copy {
	const base: Copy = { ...DEFAULT_COPY, ...(COPY_BY_KIND[kind] ?? {}) };
	if (kind === "confirm_components") {
		const phrase = joinLabels(labelsForComponents(unconfirmedComponentTypes));
		base.banner = {
			tone: "warn",
			text: `We couldn't verify ${phrase}. Please double-check or edit.`,
		};
		base.continueLabel = "Confirm";
	}
	return base;
}
