import DashboardLayout from "@/components/DashboardLayout";

const LostFoundPage = () => {
	return (
		<DashboardLayout>
			<div className="max-w-4xl">
				<h1 className="text-3xl font-bold text-foreground">Lost &amp; Found</h1>
				<p className="mt-4 text-muted-foreground">
					Item reports, claims, and campus recovery flows belong in this module.
				</p>
			</div>
		</DashboardLayout>
	);
};

export default LostFoundPage;
