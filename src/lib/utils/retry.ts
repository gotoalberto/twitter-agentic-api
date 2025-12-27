/**
 * Retry utility with exponential backoff
 *
 * This utility helps retry operations that might fail temporarily,
 * with increasing delays between attempts to avoid overwhelming services.
 */

export interface RetryOptions {
  maxAttempts?: number; // Maximum number of retry attempts (default: 3)
  initialDelayMs?: number; // Initial delay in milliseconds (default: 1000)
  maxDelayMs?: number; // Maximum delay in milliseconds (default: 10000)
  backoffMultiplier?: number; // Multiplier for exponential backoff (default: 2)
  onRetry?: (error: Error, attempt: number, delayMs: number) => void; // Callback on retry
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - The async operation to retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with the operation result or rejects with the last error
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error('API request failed');
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let currentDelay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();

      if (attempt > 1) {
        console.log(`✅ Operation succeeded on attempt ${attempt}/${maxAttempts}`);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        console.error(`❌ Operation failed after ${maxAttempts} attempts`);
        console.error(`   Last error: ${lastError.message}`);
        throw lastError;
      }

      // Calculate delay for next attempt (with exponential backoff)
      const delayMs = Math.min(currentDelay, maxDelayMs);

      // Log retry attempt
      console.warn(`⚠️  Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
      console.warn(`   Retrying in ${delayMs}ms...`);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);

      // Increase delay for next attempt
      currentDelay *= backoffMultiplier;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Retry an operation and return a result object instead of throwing
 *
 * Useful when you want to handle failures without try/catch
 *
 * @param operation - The async operation to retry
 * @param options - Retry configuration options
 * @returns Promise that always resolves with a RetryResult
 *
 * @example
 * ```typescript
 * const { success, result, error, attempts } = await retryWithBackoffSafe(
 *   async () => fetchData(),
 *   { maxAttempts: 3 }
 * );
 *
 * if (success) {
 *   console.log('Got result:', result);
 * } else {
 *   console.error('Failed after', attempts, 'attempts:', error);
 * }
 * ```
 */
export async function retryWithBackoffSafe<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const maxAttempts = options.maxAttempts || 3;
  let attempts = 0;

  try {
    const result = await retryWithBackoff(operation, {
      ...options,
      onRetry: (error, attempt, delay) => {
        attempts = attempt;
        if (options.onRetry) {
          options.onRetry(error, attempt, delay);
        }
      },
    });

    return {
      success: true,
      result,
      attempts: attempts > 0 ? attempts : 1,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts: maxAttempts,
    };
  }
}
