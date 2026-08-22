import DashboardLayout from "@/components/DashboardLayout";

const LibraryPage = () => {
	return (
		<DashboardLayout>
			<div className="max-w-4xl">
				<h1 className="text-3xl font-bold text-foreground">Library</h1>
				<p className="mt-4 text-muted-foreground">
					Catalog, loan tracking, and book availability will live in this feature area.
				</p>
			</div>
		</DashboardLayout>
	);
};

export default LibraryPage;
