export async function runSmokeActivationWithFence(
  operation: () => Promise<void>,
  fence: () => Promise<void>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    await fence().catch(() => {});
    throw error;
  }
}
