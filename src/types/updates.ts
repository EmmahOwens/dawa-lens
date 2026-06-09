// TypeScript types for the update system

type Update = {
    id: string;
    title: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
};

interface UpdatesResponse {
    updates: Update[];
    total: number;
}

export { Update, UpdatesResponse };