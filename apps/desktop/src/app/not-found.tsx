import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center text-center">
      <div className="bg-surface-container border border-outline-variant rounded-lg p-xl max-w-[600px] w-full tech-shadow">
        <span className="material-symbols-outlined text-outline text-[80px] mb-md font-light">search_off</span>
        <h2 className="text-[32px] font-bold text-on-surface mb-sm font-[Inter]">404 - Not Found</h2>
        <p className="text-on-surface-variant mb-xl font-[Inter] text-[16px]">
          The page or resource you are looking for does not exist in this workspace.
        </p>
        
        <div className="flex justify-center">
          <Link
            href="/"
            className="bg-primary text-on-primary px-8 py-3 rounded font-semibold hover:bg-primary-container transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined">home</span>
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
