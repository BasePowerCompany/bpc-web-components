import { useEffect, useId, useMemo, useRef, useState } from "react";
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

interface ComboBoxOverlayProps {
	zIndex: number;
	inputRef: React.RefObject<HTMLInputElement | null>;
	value: string;
	placeholder?: string;
	onChange: (value: string) => void;
	results: Result[];
	onSelect?: ({ result }: { result: Result }) => void;
	portalRoot: ShadowRoot;
	close: () => void;
	overlayPosition: OverlayPosition | null;
	isActivated: boolean;
}

function ComboBoxOverlay({
	zIndex,
	inputRef,
	value,
	placeholder,
	onChange,
	results,
	onSelect,
	portalRoot,
	close,
	overlayPosition,
	isActivated,
}: ComboBoxOverlayProps) {
	const resultsRef = useRef<HTMLDivElement>(null);
	const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

	const listboxId = useId();

	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset highlighted index when results change
	useEffect(() => {
		setHighlightedIndex(0);
	}, [results]);

	const expanded = isActivated && results.length > 0;
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

	// When not activated, position offscreen to avoid flash of wrong position
	const positionStyle: React.CSSProperties =
		isActivated && overlayPosition
			? {
					top: overlayPosition.top,
					left: overlayPosition.left,
					width: overlayPosition.width,
					zIndex: 1001,
				}
			: {
					top: -9999,
					left: -9999,
					width: 300,
					zIndex: zIndex,
					visibility: "hidden" as const,
				};

	return createPortal(
		<>
			<div
				className={styles.overlay}
				style={{ display: isActivated ? "block" : "none" }}
			/>
			<div className={styles.inputPositioner} style={positionStyle}>
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
								// biome-ignore lint/a11y/useKeyWithClickEvents: We want to prevent the input blur before the click handler runs
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
						ref={inputRef}
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
	const inputRef = useRef<HTMLInputElement>(null);
	const [isActivated, setIsActivated] = useState(false);
	const [overlayPosition, setOverlayPosition] =
		useState<OverlayPosition | null>(null);

	// Calculate position from the placeholder element
	const updatePosition = () => {
		const element = inputContainerRef.current;
		if (!element) return;

		const rect = element.getBoundingClientRect();
		setOverlayPosition({
			top: rect.top + window.scrollY,
			left: rect.left + window.scrollX,
			width: rect.width,
		});
	};

	function activate() {
		updatePosition();
		setIsActivated(true);
		// Focus immediately - input already exists in DOM (for iOS Safari)
		inputRef.current?.focus();
	}

	function close() {
		setIsActivated(false);
	}

	// Continuously sync position while overlay is active
	// This handles late-loading images and any layout shifts
	useEffect(() => {
		if (!isActivated) return;

		let rafId: number;

		const syncPosition = () => {
			const element = inputContainerRef.current;
			if (element) {
				const rect = element.getBoundingClientRect();
				setOverlayPosition((prev) => {
					const newTop = rect.top + window.scrollY;
					const newLeft = rect.left + window.scrollX;
					const newWidth = rect.width;
					// Only update if position actually changed
					if (
						prev &&
						prev.top === newTop &&
						prev.left === newLeft &&
						prev.width === newWidth
					) {
						return prev;
					}
					return { top: newTop, left: newLeft, width: newWidth };
				});
			}
			rafId = requestAnimationFrame(syncPosition);
		};

		rafId = requestAnimationFrame(syncPosition);

		return () => {
			cancelAnimationFrame(rafId);
		};
	}, [isActivated]);

	return (
		<>
			<div className={cx(styles.autocomplete, isActivated && styles.activated)}>
				{/* Placeholder for positioning - hidden when activated */}
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
						{value || placeholder}
					</button>
					<MapPin className={styles.mapPin} />
					{!!cta && <CtaButton title={cta} onClick={activate} />}
				</div>

				{/* Input always rendered in portal for iOS Safari focus */}
				<ComboBoxOverlay
					zIndex={zIndex}
					inputRef={inputRef}
					value={value}
					placeholder={placeholder}
					onChange={onChange}
					results={results}
					onSelect={onSelect}
					portalRoot={portalRoot}
					close={close}
					overlayPosition={overlayPosition}
					isActivated={isActivated}
				/>
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
