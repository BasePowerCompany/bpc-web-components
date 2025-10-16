import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "@/utils/cx";
import MapPin from "./MapPin";
import styles from "./styles.module.css";

export interface Result {
	mainText: string;
	secondaryText: string;
	id: string;
}

interface AutocompleteProps {
	value: string;
	placeholder?: string;
	cta?: string;
	onChange: (value: string) => void;
	results: Result[];
	onSelect?: ({ result }: { result: Result }) => void;
}

export function Autocomplete({
	value,
	placeholder,
	cta,
	onChange,
	results,
	onSelect,
}: AutocompleteProps) {
	const resultsRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const [isActivated, setIsActivated] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

	const listboxId = useId(); // unique id for aria-controls

	// biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset the highlighted index when the results change or the menu closes
	useEffect(() => {
		setHighlightedIndex(0);
	}, [results]);

	const expanded = isActivated && results.length > 0;

	const activeDescendant = useMemo(() => {
		if (!expanded || highlightedIndex < 0) return undefined;
		return `${listboxId}-option-${results[highlightedIndex]?.id}`;
	}, [expanded, highlightedIndex, listboxId, results]);

	function open() {
		setIsActivated(true);
	}

	function close() {
		setIsActivated(false);
		setHighlightedIndex(-1);
	}

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
				console.log("value", value);
				if (!value) {
					close();
				}
				break;
			}
			default:
				break;
		}
	}

	return (
		<>
			<div className={cx(styles.autocomplete, isActivated && styles.activated)}>
				{isActivated && <div className={styles.overlay} />}
				<div className={styles.inputContainer}>
					<input
						ref={inputRef}
						value={value}
						onChange={(e) => {
							onChange(e.target.value);
							if (!isActivated) open();
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
					{!!cta && (
						<button
							type="button"
							className={styles.activateButton}
							onClick={() => inputRef.current?.focus()}
							tabIndex={-1}
						>
							{cta}
						</button>
					)}
				</div>

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
			</div>

			{!!cta && (
				<button
					type="button"
					className={cx(styles.activateButton, styles.mobileBtn)}
					onClick={() => inputRef.current?.focus()}
					tabIndex={-1}
				>
					{cta}
				</button>
			)}
		</>
	);
}
