import DashboardLayout from "@/components/DashboardLayout";

const MedicalPage = () => {
	return (
		<DashboardLayout>
			<div className="max-w-4xl">
				<h1 className="text-3xl font-bold text-foreground">Medical</h1>
				<p className="mt-4 text-muted-foreground">
					Appointments, wellness records, and service requests can live in this feature module.
				</p>
			</div>
		</DashboardLayout>
	);
};

export default MedicalPage;
