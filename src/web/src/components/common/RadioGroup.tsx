import React, { useCallback, useRef } from 'react';
import styled from '@emotion/styled';

// Interfaces
interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  'aria-label': string;
  'aria-describedby'?: string;
  theme?: any; // Theme type would be defined in your theme configuration
}

// Styled Components
const RadioGroupContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;

  &[data-error='true'] {
    border-color: ${props => props.theme.palette.error.main};
  }
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: ${props => props.theme.palette.text.primary};
  user-select: none;

  &[data-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const RadioInput = styled.input`
  appearance: none;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid ${props => props.theme.palette.primary.main};
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:checked {
    background-color: ${props => props.theme.palette.primary.main};

    &::after {
      content: '';
      position: absolute;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background-color: ${props => props.theme.palette.common.white};
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.palette.primary.light};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &[data-error='true'] {
    border-color: ${props => props.theme.palette.error.main};
  }
`;

const ErrorText = styled.span`
  color: ${props => props.theme.palette.error.main};
  font-size: 0.75rem;
  margin-top: 0.25rem;
`;

const RadioGroup: React.FC<RadioGroupProps> = ({
  options,
  value,
  onChange,
  name,
  disabled = false,
  className,
  error,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const radioRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      event.preventDefault();
      if (!disabled) {
        const newValue = event.target.value;
        onChange(newValue);
      }
    },
    [disabled, onChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
      const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!validKeys.includes(event.key)) return;

      event.preventDefault();
      const optionsLength = options.length;
      let nextIndex: number;

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + optionsLength) % optionsLength;
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % optionsLength;
          break;
        default:
          return;
      }

      // Skip disabled options
      while (options[nextIndex].disabled && nextIndex !== currentIndex) {
        nextIndex = (nextIndex + 1) % optionsLength;
      }

      if (!options[nextIndex].disabled) {
        const nextInput = radioRefs.current[nextIndex];
        nextInput?.focus();
        onChange(options[nextIndex].value);
      }
    },
    [options, onChange]
  );

  const errorId = error ? `${name}-error` : undefined;

  return (
    <RadioGroupContainer
      className={className}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      data-error={!!error}
    >
      {options.map((option, index) => {
        const isDisabled = disabled || option.disabled;
        const optionId = `${name}-${option.value}`;

        return (
          <RadioLabel
            key={option.value}
            htmlFor={optionId}
            data-disabled={isDisabled}
          >
            <RadioInput
              ref={el => (radioRefs.current[index] = el)}
              type="radio"
              id={optionId}
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={isDisabled}
              onChange={handleChange}
              onKeyDown={e => handleKeyDown(e, index)}
              aria-describedby={option.description ? `${optionId}-desc` : errorId}
              data-error={!!error}
            />
            {option.label}
            {option.description && (
              <span id={`${optionId}-desc`} style={{ display: 'none' }}>
                {option.description}
              </span>
            )}
          </RadioLabel>
        );
      })}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </RadioGroupContainer>
  );
};

export default RadioGroup;