export const getInitials = (text: string): string => {
  if (!text) return "?";
  
  // Clean text and split by spaces
  const parts = text.trim().split(/\s+/);
  
  if (parts.length === 0) return "?";
  
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  // Take first letter of first two words
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
