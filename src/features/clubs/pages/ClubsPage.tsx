import DashboardLayout from "@/components/DashboardLayout";

const ClubsPage = () => {
	return (
		<DashboardLayout>
			<div className="max-w-4xl">
				<h1 className="text-3xl font-bold text-foreground">Clubs</h1>
				<p className="mt-4 text-muted-foreground">
					Club membership, events, and announcements can live in this feature module.
				</p>
			</div>
		</DashboardLayout>
	);
};

export default ClubsPage;
