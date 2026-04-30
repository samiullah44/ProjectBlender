// Matches the API response shape for a populated comment
export interface IComment {
  _id: string;
  blogId: string;
  authorId: {
    _id: string;
    name: string;
    username: string;
  };
  text: string;
  claps: number;
  clappers: string[];   // array of userId strings
  hidden: boolean;      // admin-controlled visibility
  editedAt?: string;    // ISO date string — set when edited
  createdAt: string;    // ISO date string
  updatedAt: string;
}
