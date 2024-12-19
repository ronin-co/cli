/**
 * Fetches all available spaces for the authenticated user session.
 *
 * @param sessionToken - Authentication token used to authorize the API request.
 *
 * @returns Promise resolving to an array of space objects containing id, handle and name.
 *
 * @throws {Error} If the API request fails or returns an error response.
 *
 * @example
 * ```typescript
 * const spaces = await getSpaces('user-session-token');
 * // Returns: [{ id: '123', handle: 'my-space', name: 'My Space' }, ...]
 * ```
 */
export const getSpaces = async (
  sessionToken: string,
): Promise<Array<{ id: string; handle: string; name: string }>> => {
  try {
    const response = await fetch('https://ronin.co/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${sessionToken}`,
      },
      body: JSON.stringify({
        queries: [
          {
            get: {
              members: { including: ['space', 'account'] },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = (await response.json()) as {
      results: Array<Array<{ space: { id: string; handle: string; name: string } }>>;
      error?: string;
    };

    if (data.error) {
      throw new Error(data.error);
    }

    return data.results[0].map((member) => member.space);
  } catch (error) {
    throw new Error(`Failed to fetch available spaces: ${(error as Error).message}`);
  }
};
