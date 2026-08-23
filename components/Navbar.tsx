import Logo from "./Logo";
import NavControls from "./NavControls";
import Sections from "./Sections";
import { MobileMenu } from "./MobileMenu";

function Navbar() {
  return (
    <nav className="z-50 bg-white/70 dark:bg-transparent backdrop-blur-md fixed top-0 left-0 w-full flex justify-between items-center px-5 py-5 sm:px-10 text-main-gray">
      <Logo />
      <Sections />
      <div className="flex items-center gap-3">
        <NavControls />
        <MobileMenu />
      </div>
    </nav>
  );
}

export default Navbar;
