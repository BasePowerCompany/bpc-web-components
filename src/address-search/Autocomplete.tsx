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
	right: number;
	bottom: number;
	width: number;
	height: number;
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
	ref: React.RefObject<HTMLInputElement | null>;
	value: string;
	placeholder?: string;
	onChange: (value: string) => void;
	results: Result[];
	onSelect?: ({ result }: { result: Result }) => void;
	portalRoot: ShadowRoot;
	close: () => void;
	open: () => void;
	overlayPosition: OverlayPosition | null;
	isActivated: boolean;
	cta?: string;
}

export function ComboBoxOverlay({
	zIndex,
	ref: inputRef,
	value,
	placeholder,
	onChange,
	results,
	onSelect,
	portalRoot,
	close,
	open,
	overlayPosition,
	isActivated,
	cta,
}: ComboBoxOverlayProps) {
	const resultsRef = useRef<HTMLDivElement>(null);
	const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

	const listboxId = useId(); // unique id for aria-controls

	// biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset the highlighted index when the results change or the menu closes
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
		// Update the text field and notify host
		onChange(item.mainText);
		onSelect?.({ result: item });
		inputRef.current?.blur();
		close();
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (!expanded) {
			if (e.key === "ArrowDown" && results.length > 0) {
				e.preventDefault();
				open();
				setHighlightedIndex(0);
			}
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
			<div
				className={styles.overlay}
				style={{ display: isActivated ? "block" : "none" }}
			/>
			<div
				className={styles.inputPositioner}
				style={{
					...(overlayPosition || {}),
					zIndex: isActivated ? 1001 : zIndex,
				}}
			>
				{expanded && (
					<div
						ref={resultsRef}
						id={listboxId}
						className={styles.results}
						role="listbox"
						aria-label="Suggestions"
						// Prevent input blur before click handler runs
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
									// Prevent input blur before click handler runs
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
						onChange={(e) => {
							onChange(e.target.value);
						}}
						placeholder={placeholder}
						autoComplete="home street-address"
						className={styles.input}
						onFocus={open}
						onBlur={close}
						onKeyDown={onKeyDown}
						role="combobox"
						aria-expanded={expanded}
						aria-controls={expanded ? listboxId : undefined}
						aria-activedescendant={activeDescendant}
						aria-autocomplete="list"
					/>
					<MapPin className={styles.mapPin} />
					{!!cta && !isActivated && <CtaButton title={cta} onClick={open} />}
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

	function open() {
		setIsActivated(true);
		inputRef.current?.focus();
	}

	useEffect(() => {
		const element = inputContainerRef.current;
		if (!element) return;

		const updatePosition = () => {
			const rect = element.getBoundingClientRect();
			setOverlayPosition({
				top: rect.top + window.scrollY,
				left: rect.left + window.scrollX,
				right: rect.right + window.scrollX,
				bottom: rect.bottom + window.scrollY,
				width: rect.width,
				height: rect.height,
			});
		};

		// Initial position
		updatePosition();

		// Watch for resize
		const resizeObserver = new ResizeObserver(updatePosition);
		resizeObserver.observe(element);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	return (
		<>
			<div className={cx(styles.autocomplete, isActivated && styles.activated)}>
				{/* Hidden input container for positioning */}
				<div
					className={styles.inputContainer}
					ref={inputContainerRef}
					style={{ visibility: "hidden" }}
				>
					<button
						className={cx(styles.input, !value && styles.placeholder)}
						type="button"
						onClick={open}
						onFocus={open}
					>
						{!value ? placeholder : value}
					</button>
					<MapPin className={styles.mapPin} />
					{!!cta && <CtaButton title={cta} onClick={open} />}
				</div>
				<ComboBoxOverlay
					zIndex={zIndex}
					ref={inputRef}
					value={value}
					placeholder={placeholder}
					onChange={onChange}
					results={results}
					onSelect={onSelect}
					portalRoot={portalRoot}
					close={() => setIsActivated(false)}
					open={open}
					overlayPosition={overlayPosition}
					isActivated={isActivated}
					cta={cta}
				/>
			</div>

			{!!cta && (
				<CtaButton title={cta} onClick={open} className={styles.mobileBtn} />
			)}
		</>
	);
}
