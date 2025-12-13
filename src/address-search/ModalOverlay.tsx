import { createPortal } from "react-dom";
import styles from "./styles.module.css";

interface ModalOverlayProps {
  portalRoot: ShadowRoot;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
}

export function ModalOverlay({
  portalRoot,
  isOpen,
  onClose,
  children,
  zIndex = 1001,
}: ModalOverlayProps) {
  if (!isOpen) return null;

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal} style={{ zIndex }}>
        <button type="button" className={styles.modalClose} onClick={onClose}>
          ×
        </button>
        <div className={styles.modalContent}>{children}</div>
      </div>
    </>,
    portalRoot
  );
}
