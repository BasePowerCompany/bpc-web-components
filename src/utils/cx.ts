export const cx = (...classes: (string | undefined | false)[]) => {
	return classes.filter(Boolean).join(" ");
};
