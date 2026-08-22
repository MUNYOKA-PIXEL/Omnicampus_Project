import DashboardLayout from "@/components/DashboardLayout";

const ProfilePage = () => {
	return (
		<DashboardLayout>
			<div className="max-w-4xl">
				<h1 className="text-3xl font-bold text-foreground">Profile</h1>
				<p className="mt-4 text-muted-foreground">
					Student and staff profile information and settings belong in this module.
				</p>
			</div>
		</DashboardLayout>
	);
};

export default ProfilePage;
