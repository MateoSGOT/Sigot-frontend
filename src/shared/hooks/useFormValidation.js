import { useState, useCallback } from 'react';
import { validateForm, hasErrors } from '../utils/validators.js';

/**
 * Manejo de validación en tiempo real para un formulario.
 * @param {Object} rules  mapa { campo: (valor, valores) => mensajeError | '' }
 */
export function useFormValidation(rules) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const revalidate = useCallback((values) => setErrors(validateForm(values, rules)), [rules]);
  const markTouched = useCallback((name) => setTouched((t) => ({ ...t, [name]: true })), []);
  const touchAll = useCallback(
    () => setTouched(Object.keys(rules).reduce((a, k) => ({ ...a, [k]: true }), {})),
    [rules]
  );
  const fieldError = useCallback((name) => (touched[name] ? errors[name] : '') || '', [touched, errors]);
  const isInvalid = useCallback((values) => hasErrors(validateForm(values, rules)), [rules]);
  const validateNow = useCallback((values) => validateForm(values, rules), [rules]);
  const reset = useCallback(() => { setErrors({}); setTouched({}); }, []);

  return { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset };
}
