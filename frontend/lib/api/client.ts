import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Timeout configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds for most requests
// AI plan generation can take several minutes (large JSON completions), and may
// retry once with a larger token budget.
const LONG_OPERATION_TIMEOUT = 300000; // 5 minutes for AI generation (plans, quizzes)

// Endpoints that need longer timeout (AI generation)
const LONG_TIMEOUT_PATTERNS = [
  '/generate',
  '/planner/generate',
  '/quiz/generate',
];

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<T> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    // Determine timeout based on endpoint
    const isLongOperation = LONG_TIMEOUT_PATTERNS.some(pattern => endpoint.includes(pattern));
    const timeout = options.timeout ?? (isLongOperation ? LONG_OPERATION_TIMEOUT : DEFAULT_TIMEOUT);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      // Handle rate limiting (429) - returns plain text
      if (response.status === 429) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Too many requests. Please wait a moment.';

        if (contentType?.includes('application/json')) {
          const data = await response.json();
          errorMessage = data?.error?.message ?? data?.message ?? errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }

        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Try to parse JSON, handle non-JSON responses
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (!response.ok) {
          toast.error(text || 'An error occurred');
          throw new Error(text || 'An error occurred');
        }
        return text as T;
      }

      if (!response.ok) {
        // Extract error message from various possible formats
        let errorMessage = 'An error occurred';
        
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          // Handle nested error objects
          if (typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (data.error.message) {
            errorMessage = data.error.message;
          }
        }
        
        // Handle 401 unauthorized - clear token and redirect
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
          }
        }
        
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      return data.data as T;
    } catch (error) {
      // Handle timeout (AbortError)
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = 'Request timed out. Please try again.';
        toast.error(timeoutError);
        throw new Error(timeoutError);
      }
      
      // Handle network errors or JSON parsing errors
      if (error instanceof Error) {
        throw error;
      }
      const networkError = 'Network error occurred. Please check your connection.';
      toast.error(networkError);
      throw new Error(networkError);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export { API_URL };
