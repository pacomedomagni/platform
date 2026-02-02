import Link from 'next/link';
import { Button } from '@platform/ui';

export default function DeskHome() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center space-y-4">
            <h1 className="text-4xl font-bold">Noslag Desk</h1>
            <p className="text-muted-foreground">The Metadata Driven ERP Spec</p>
            <div className="flex space-x-4">
                 <Link href="/desk/Sales Order/new">
                    <Button>New Sales Order</Button>
                 </Link>
                 <Link href="/desk/Customer/new">
                    <Button variant="outline" className="bg-white">New Customer</Button>
                 </Link>
            </div>
        </div>
    )
}
