import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { CtaButton } from "@/address-search/CtaButton";
import { cx } from "@/utils/cx";
import MapPin from "./MapPin";
import styles from "./styles.module.css";

export interface Result {
	mainText: string;
	secondaryText: string;
	id: string;
}

type OverlayPosition = {
	top: number;
	left: number;
	width: number;
};

interface AutocompleteProps {
	zIndex: number;
	value: string;
	placeholder?: string;
	cta?: string;
	onChange: (value: string) => void;
	results: Result[];
	onSelect?: ({ result }: { result: Result }) => void;
	portalRoot: ShadowRoot;
}

interface ActivatedOverlayProps {
	zIndex: number;
	value: string;
	placeholder?: string;
	onChange: (value: string) => void;
	results: Result[];
	onSelect?: ({ result }: { result: Result }) => void;
	portalRoot: ShadowRoot;
	close: () => void;
	overlayPosition: OverlayPosition;
}

function ActivatedOverlay({
	value,
	placeholder,
	onChange,
	results,
	onSelect,
	portalRoot,
	close,
	overlayPosition,
}: ActivatedOverlayProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const resultsRef = useRef<HTMLDivElement>(null);
	const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

	const listboxId = useId();

	// Callback ref: focuses input immediately when DOM element is attached
	// This is more reliable than useEffect for mobile Safari
	const setInputRef = useCallback((el: HTMLInputElement | null) => {
		inputRef.current = el;
		if (el) {
			el.focus();
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset highlighted index when results change
	useEffect(() => {
		setHighlightedIndex(0);
	}, [results]);

	const expanded = results.length > 0;
	const activeDescendant = useMemo(() => {
		if (!expanded || highlightedIndex < 0) return undefined;
		return `${listboxId}-option-${results[highlightedIndex]?.id}`;
	}, [expanded, highlightedIndex, listboxId, results]);

	function commitSelection(index: number) {
		const item = results[index];
		if (!item) return;
		onChange(item.mainText);
		onSelect?.({ result: item });
		inputRef.current?.blur();
		close();
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (!expanded) {
			if (e.key === "Escape") {
				e.preventDefault();
				inputRef.current?.blur();
			}
			return;
		}

		switch (e.key) {
			case "ArrowDown": {
				e.preventDefault();
				setHighlightedIndex((prev) =>
					prev < results.length - 1 ? prev + 1 : 0,
				);
				break;
			}
			case "ArrowUp": {
				e.preventDefault();
				setHighlightedIndex((prev) =>
					prev > 0 ? prev - 1 : results.length - 1,
				);
				break;
			}
			case "ArrowRight": {
				e.preventDefault();
				onChange(results[highlightedIndex]?.mainText || "");
				break;
			}
			case "Home": {
				e.preventDefault();
				setHighlightedIndex(0);
				break;
			}
			case "End": {
				e.preventDefault();
				setHighlightedIndex(results.length - 1);
				break;
			}
			case "Enter": {
				if (highlightedIndex >= 0) {
					e.preventDefault();
					commitSelection(highlightedIndex);
				}
				break;
			}
			case "Escape": {
				e.preventDefault();
				setHighlightedIndex(-1);
				onChange("");
				if (!value) {
					close();
				}
				break;
			}
			default:
				break;
		}
	}

	return createPortal(
		<>
			<div className={styles.overlay} />
			<div
				className={styles.inputPositioner}
				style={{
					top: overlayPosition.top,
					left: overlayPosition.left,
					width: overlayPosition.width,
					zIndex: 1001,
				}}
			>
				{expanded && (
					<div
						ref={resultsRef}
						id={listboxId}
						className={styles.results}
						role="listbox"
						aria-label="Suggestions"
						onMouseDown={(e) => e.preventDefault()}
					>
						{results.map((result, idx) => {
							const isActive = idx === highlightedIndex;
							const optionId = `${listboxId}-option-${result.id}`;
							return (
								// biome-ignore lint/a11y/useKeyWithClickEvents: Prevent input blur before click
								<div
									key={result.id}
									id={optionId}
									role="option"
									aria-selected={isActive}
									className={cx(styles.result, isActive && styles.resultActive)}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => commitSelection(idx)}
									onMouseEnter={() => setHighlightedIndex(idx)}
									tabIndex={-1}
								>
									{result.mainText}
									<span>{result.secondaryText}</span>
								</div>
							);
						})}
					</div>
				)}
				<div className={styles.inputContainer}>
					<input
						name="address-search"
						ref={setInputRef}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder={placeholder}
						autoComplete="home street-address"
						className={styles.input}
						onBlur={close}
						onKeyDown={onKeyDown}
						role="combobox"
						aria-expanded={expanded}
						aria-controls={expanded ? listboxId : undefined}
						aria-activedescendant={activeDescendant}
						aria-autocomplete="list"
					/>
					<MapPin className={styles.mapPin} />
				</div>
			</div>
		</>,
		portalRoot,
	);
}

export function Autocomplete({
	zIndex,
	value,
	placeholder,
	cta,
	onChange,
	results,
	onSelect,
	portalRoot,
}: AutocompleteProps) {
	const inputContainerRef = useRef<HTMLDivElement>(null);
	const [isActivated, setIsActivated] = useState(false);
	const [overlayPosition, setOverlayPosition] =
		useState<OverlayPosition | null>(null);

	function activate() {
		const element = inputContainerRef.current;
		if (!element) return;

		// Calculate position at moment of activation
		const rect = element.getBoundingClientRect();
		setOverlayPosition({
			top: rect.top + window.scrollY,
			left: rect.left + window.scrollX,
			width: rect.width,
		});
		setIsActivated(true);
	}

	function close() {
		setIsActivated(false);
		setOverlayPosition(null);
	}

	return (
		<>
			<div className={cx(styles.autocomplete, isActivated && styles.activated)}>
				{/* Real input container - visible when not activated */}
				<div
					className={styles.inputContainer}
					ref={inputContainerRef}
					style={{ visibility: isActivated ? "hidden" : "visible" }}
				>
					<button
						className={cx(styles.input, !value && styles.placeholder)}
						type="button"
						onClick={activate}
						onFocus={activate}
					>
						{value || placeholder || "Enter your home address"}
					</button>
					<MapPin className={styles.mapPin} />
					{!!cta && <CtaButton title={cta} onClick={activate} />}
				</div>

				{/* Portal overlay - only rendered when activated */}
				{isActivated && overlayPosition && (
					<ActivatedOverlay
						zIndex={zIndex}
						value={value}
						placeholder={placeholder}
						onChange={onChange}
						results={results}
						onSelect={onSelect}
						portalRoot={portalRoot}
						close={close}
						overlayPosition={overlayPosition}
					/>
				)}
			</div>

			{!!cta && (
				<CtaButton
					title={cta}
					onClick={activate}
					className={styles.mobileBtn}
				/>
			)}
		</>
	);
}
